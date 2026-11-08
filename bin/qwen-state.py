#!/usr/bin/env python3
"""qwen-state.py — filter: reads the Qwen rollout sources, prints ONE aggregates-only JSON to stdout.

PUBLIC page. The output is built from a whitelist: every value is a count, a sum, a date bucket or a
fixed category name. Nothing is copied from a source row, so a new per-message field upstream can't leak.
Never exported: message ids, subjects, senders, issue titles, issue numbers, repo names, accounts.

Sources (override with env for tests): QWEN_RUNS (cos/runs dir), QWEN_COST_DB (cos/state/cost.db),
QWEN_TAG_LOG / QWEN_TAG_JSONL (the canonical issue-tag.{log,jsonl} in ~/.local/state/issue-tag, or ISSUE_TAG_STATE; skill-library#564).
QWEN_CRON_RUNS (cron-triage runs.jsonl), QWEN_DECLUTTER / QWEN_REAP (their qwen.jsonl); each may be a colon-separated list (site#79).
Usage: bin/qwen-state.py [--now ISO]
"""
import glob, json, os, re, sqlite3, sys
from datetime import datetime, timezone
from collections import defaultdict

HOME = os.path.expanduser("~")
RUNS = os.environ.get("QWEN_RUNS", f"{HOME}/worktrees/mycroft/live/cos/runs")
COST_DB = os.environ.get("QWEN_COST_DB", f"{HOME}/worktrees/mycroft/live/cos/state/cost.db")
TAG_DIR = os.environ.get("ISSUE_TAG_STATE", f"{HOME}/.local/state/issue-tag")
# Paths may be a colon-separated list; the tagger now logs to one canonical dir whatever checkout runs it (skill-library#564).
TAG_LOGS = os.environ.get("QWEN_TAG_LOG", f"{TAG_DIR}/issue-tag.log").split(":")
TAG_JSONLS = os.environ.get("QWEN_TAG_JSONL", f"{TAG_DIR}/issue-tag.jsonl").split(":")

STATE = f"{HOME}/.local/state"
CRON_RUNS = os.environ.get("QWEN_CRON_RUNS", f"{STATE}/cron-triage/runs.jsonl").split(":")
DECLUTTER = os.environ.get("QWEN_DECLUTTER", f"{STATE}/declutter/qwen.jsonl").split(":")
REAP = os.environ.get("QWEN_REAP", f"{STATE}/session-reap/qwen.jsonl").split(":")
# Escalation reasons that are a design rule, not a Qwen failure (skill-library#583): reported apart from fallbacks.
POLICY = ("needs-name", "needs-del")

LABELS = {"reply", "task", "fyi", "archive"}  # triage task labels (fixed set; anything else -> other)
REASONS = ["bad-class", "timeout", "exit-N", "no-ql", "other"]
WORKFLOWS = ["triage", "issue-tag"]


def reason_bucket(r):
    r = str(r or "").lower()
    if "bad-class" in r or "bad_class" in r: return "bad-class"
    if "timeout" in r or "timed out" in r: return "timeout"
    if re.search(r"exit[-_ ]?\d+", r): return "exit-N"
    if "no-ql" in r or "no_ql" in r: return "no-ql"
    return "other"


def day(ts):
    m = re.match(r"(\d{4}-\d{2}-\d{2})", str(ts or ""))
    return m.group(1) if m else None


def rows(path):
    for p in path if isinstance(path, list) else [path]:
        try:
            with open(p) as f:
                for line in f:
                    try: yield json.loads(line)
                    except ValueError: pass
        except OSError:
            continue


def day_of_run(path):
    m = re.search(r"(\d{4})(\d{2})(\d{2})-", os.path.basename(path))
    return f"{m[1]}-{m[2]}-{m[3]}" if m else None


def live_stems():
    """Run stems whose sidecar is a live run (mode == "create") that used Qwen. Dry runs are dropped from the public page."""
    out = set()
    for p in glob.glob(f"{RUNS}/*.json"):
        d = _load(p)
        if d.get("mode") == "create" and isinstance(d.get("qwen"), dict):
            out.add(os.path.basename(p)[:-len(".json")])
    return out


def live_audits():
    live = live_stems()
    return [p for p in sorted(glob.glob(f"{RUNS}/*.audit.jsonl")) if os.path.basename(p)[:-len(".audit.jsonl")] in live]


def triage():
    share = defaultdict(lambda: {"answered": 0, "fell_back": 0, "capped": 0})
    reasons = {k: 0 for k in REASONS}
    labels = {k: 0 for k in sorted(LABELS) + ["other"]}
    lat = []
    live = live_stems()
    for p in sorted(glob.glob(f"{RUNS}/*.json")):
        d = _load(p)
        q = d.get("qwen") if os.path.basename(p)[:-len(".json")] in live else None
        dy = day_of_run(p)
        if not isinstance(q, dict) or not dy: continue
        seen, ans, esc = int(q.get("seen") or 0), int(q.get("qwen") or 0), int(q.get("escalated") or 0)
        # Reason "cap" is the ramp holding a message back on purpose, not a Qwen failure: the
        # sidecar counts it in escalated, so move it to capped and keep it out of fallback reasons.
        cap = int((q.get("reasons") or {}).get("cap") or 0)
        share[dy]["answered"] += ans
        share[dy]["fell_back"] += esc - cap
        share[dy]["capped"] += cap + max(seen - ans - esc, 0)
        for r, n in (q.get("reasons") or {}).items():
            if r == "cap": continue
            reasons[reason_bucket(r)] += int(n or 0)
    for p in live_audits():
        for r in rows(p):
            if r.get("tool") != "qwen_classify": continue
            if r.get("escalated"): continue
            lab = r.get("label")
            labels[lab if lab in LABELS else "other"] += 1
            if isinstance(r.get("latency_ms"), (int, float)): lat.append(float(r["latency_ms"]))
    lat.sort()
    return share, reasons, labels, lat


def costs():
    """Per day: usd per run for triage, split Qwen-era (a day Qwen answered a live message) vs before."""
    out = defaultdict(lambda: {"runs": 0, "usd": 0.0})
    try:
        con = sqlite3.connect(f"file:{COST_DB}?mode=ro", uri=True)
        for ts, job, usd in con.execute("select ts, job, usd from runs where job='triage'"):
            dy = day(ts)
            if dy: out[dy]["runs"] += 1; out[dy]["usd"] += float(usd or 0)
    except sqlite3.Error:
        pass
    return out


def qwen_run_days():
    return {day_of_run(f"{RUNS}/{st}.json") for st in live_stems()}


def _load(p):
    try: return json.load(open(p))
    except (OSError, ValueError): return {}


def issue_tag():
    share = defaultdict(lambda: {"answered": 0, "fell_back": 0, "capped": 0})
    lines = [l for p in TAG_LOGS if os.path.exists(p) for l in open(p)]
    for line in lines:
        m = re.match(r"\[(\d{4}-\d{2}-\d{2})T", line)
        if not m or "apply=1" not in line: continue  # public page counts live runs only; dry runs (apply=0) are dropped
        # The log line says qwen=N fallback=N haiku=N; the script's stdout summary says qwen_used= fallback_to_haiku= haiku_direct=.
        q = re.search(r"qwen(?:_used)?=(\d+)", line); f = re.search(r"fallback(?:_to_haiku)?=(\d+)", line); h = re.search(r"haiku(?:_direct)?=(\d+)", line)
        if not q: continue
        share[m[1]]["answered"] += int(q[1])
        share[m[1]]["fell_back"] += int(f[1]) if f else 0
        share[m[1]]["capped"] += int(h[1]) if h else 0
    models, per_run_cost = defaultdict(lambda: {"items": 0, "usd": 0.0}), 0
    for r in rows(TAG_JSONLS):
        if r.get("kind"): continue  # applied / correction rows: see tag_accuracy()
        m = "qwen" if "qwen" in str(r.get("model", "")).lower() else "haiku"
        models[m]["items"] += 1
        models[m]["usd"] += float(r.get("cost_usd") or 0)
    return share, models


def tag_accuracy():
    """skill-library#561 rows in issue-tag.jsonl. Returns (shadow agreement %, correction-free %); None until rows exist.
    Per-item fields (repo, number, labels) are read only to count; none is returned."""
    match = [r["pair"]["match"] for r in rows(TAG_JSONLS)
             if not r.get("kind") and isinstance(r.get("pair"), dict) and isinstance(r["pair"].get("match"), bool)]
    applied = sum(1 for r in rows(TAG_JSONLS) if r.get("kind") == "applied" and "qwen" in str(r.get("model", "")).lower())
    fixed = len({(r.get("repo"), r.get("number")) for r in rows(TAG_JSONLS)
                 if r.get("kind") == "correction" and "qwen" in str(r.get("model_of_origin", "")).lower()})
    agree = round(100 * sum(match) / len(match), 1) if match else None
    clean = round(100 * max(applied - fixed, 0) / applied, 1) if applied else None
    return agree, clean


def triage_accuracy(answered):
    """mycroft#670 rows in cos/runs/*.audit.jsonl. Returns (agreement %, correction-free %); None until rows exist.
    Per-message fields (id, issue, labels) are never read into the output."""
    files = live_audits()  # pairs only from live runs
    corr = f"{RUNS}/corrections.audit.jsonl"  # corrections have no run of their own
    match = [r["match"] for p in files for r in rows(p) if r.get("tool") == "qwen_pair" and isinstance(r.get("match"), bool)]
    has_corr_file = os.path.exists(corr)
    fixed = len({r.get("id") for p in files + [corr] for r in rows(p)
                 if r.get("tool") == "qwen_correction" and "qwen" in str(r.get("model_of_origin", "")).lower()})
    agree = round(100 * sum(match) / len(match), 1) if match else None
    clean = round(100 * max(answered - fixed, 0) / answered, 1) if has_corr_file and answered else None
    return agree, clean


def pct(vals, p):
    return vals[min(int(len(vals) * p), len(vals) - 1)] if vals else None


def lat_summary(lat, unit):
    lat = sorted(lat)
    return {"n": len(lat), "p50": pct(lat, 0.5), "p90": pct(lat, 0.9), "unit": unit}


def _num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0


def wf_cron():
    """Cron triage (brain#1171): one row per run in cron-triage/runs.jsonl. Reads only counts and the started day;
    the run id and the flagged jobs' names are never read into the output."""
    share = defaultdict(lambda: {"answered": 0, "fell_back": 0, "capped": 0, "policy": 0, "runs": 0, "usd": 0.0})
    lat, first, usd, runs = [], None, 0.0, 0
    for r in rows(CRON_RUNS):
        dy = day(r.get("started"))
        if not dy: continue
        esc = r.get("escalated") if isinstance(r.get("escalated"), dict) else {}
        s = share[dy]
        s["runs"] += 1; s["answered"] += int(_num(r.get("qwen_ok"))); s["fell_back"] += sum(int(_num(n)) for n in esc.values()); s["usd"] += _num(r.get("usd"))
        if _num(r.get("latency_ms")) > 0: lat.append(_num(r["latency_ms"]))
        runs += 1; usd += _num(r.get("usd")); first = min(first, dy) if first else dy
    return finish(share, lat, first, runs, usd, "run")


def wf_qwen_jsonl(paths):
    """Declutter and session-reap: one row per item sent to the rung. A run is a cluster of rows (the rows of a sweep
    share a timestamp). Escalations are split into policy (a fixed rule), capped (the ramp) and fell_back (a failure)."""
    share = defaultdict(lambda: {"answered": 0, "fell_back": 0, "capped": 0, "policy": 0, "runs": 0, "usd": 0.0})
    lat, first, usd, stamps = [], None, 0.0, []
    for r in rows(paths):
        dy = day(r.get("ts"))
        if not dy: continue
        s = share[dy]; stamps.append(str(r.get("ts"))); usd += _num(r.get("usd")); s["usd"] += _num(r.get("usd")); first = min(first, dy) if first else dy
        reason = str(r.get("reason") or "")
        if not r.get("escalated"):
            s["answered"] += 1
            if _num(r.get("latency_ms")) > 0: lat.append(_num(r["latency_ms"]))
        elif reason in POLICY: s["policy"] += 1; s.setdefault("policy_reasons", {}); s["policy_reasons"][reason] = s["policy_reasons"].get(reason, 0) + 1
        elif reason == "cap": s["capped"] += 1
        else: s["fell_back"] += 1
    starts, prev = [], None
    for t in sorted(stamps):
        try: now = datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp()
        except ValueError: continue
        if prev is None or now - prev > 120: starts.append(t)
        prev = now
    for t in starts: share[t[:10]]["runs"] += 1
    return finish(share, lat, first, len(starts), usd, "item")


def finish(share, lat, first, runs, usd, unit):
    days = [{"day": d, **{k: (round(v, 4) if k == "usd" else v) for k, v in share[d].items()}} for d in sorted(share)]
    tot = lambda k: sum(r[k] for r in days)
    reasons = defaultdict(int)
    for r in days:
        for k, n in r.get("policy_reasons", {}).items(): reasons[k] += n
    return {"first_logged": first, "runs": runs, "answered": tot("answered"), "fell_back": tot("fell_back"), "capped": tot("capped"),
            "policy": tot("policy"), "policy_reasons": dict(sorted(reasons.items())), "usd": round(usd, 4), "latency_ms": lat_summary(lat, unit),
            "share_by_day": [{k: v for k, v in r.items() if k != "policy_reasons"} for r in days]}


def workflows():
    """Every job that uses Qwen, counts only. A workflow with no rows has runs 0 and first_logged null: the page says
    "no runs logged" instead of a rate (skill-library#583)."""
    return {"cron-triage": wf_cron(), "declutter": wf_qwen_jsonl(DECLUTTER), "session-reap": wf_qwen_jsonl(REAP)}


def series(share):
    return [{"day": d, **share[d]} for d in sorted(share)]


MODEL_QWEN, MODEL_HAIKU = "qwen3-coder:30b", "claude-haiku-5-5"  # fixed names, never read from a row
LEARN = os.environ.get("QWEN_LEARN", f"{STATE}/learn/qwen.jsonl").split(":")


def triage_shadow():
    """Per day: count of live qwen_pair rows (a second Haiku call made only to compare). Counts only."""
    out = defaultdict(int)
    for p in live_audits():
        for r in rows(p):
            if r.get("tool") == "qwen_pair": out[day(r.get("ts")) or day_of_run(p)] += 1
    return out


def calls_by_day(t_share, i_share, wf, shadow):
    """One row per (day, job) that had calls. calls = items sent through the job (qwen + fallback + capped);
    haiku_shadow is extra comparison calls on top. haiku_capped also holds items a fixed rule sent to Haiku
    (needs-name / needs-del): both are Haiku on purpose, not a failure. Issue-tag pair rows carry no day, so its shadow is 0."""
    jobs = {"triage": (series(t_share), shadow), "issue-tag": (series(i_share), {}),
            "cron-triage": (wf["cron-triage"]["share_by_day"], {}), "declutter": (wf["declutter"]["share_by_day"], {}),
            "session-reap": (wf["session-reap"]["share_by_day"], {}), "learn-store-pick": (wf_qwen_jsonl(LEARN)["share_by_day"], {})}
    out = []
    for job, (days, sh) in jobs.items():
        for r in days:
            q, fb, cap, shd = r["answered"], r["fell_back"], r["capped"] + r.get("policy", 0), sh.get(r["day"], 0)
            if q + fb + cap + shd == 0: continue
            out.append({"day": r["day"], "job": job, "calls": q + fb + cap, "qwen": q, "haiku_fallback": fb, "haiku_capped": cap,
                        "haiku_shadow": shd, "model_qwen": MODEL_QWEN, "model_haiku": MODEL_HAIKU})
    out.sort(key=lambda r: r["job"])
    return sorted(out, key=lambda r: r["day"], reverse=True)  # newest day first, jobs A-Z within a day


def build():
    t_share, reasons, labels, lat = triage()
    i_share, i_models = issue_tag()
    c = costs()
    # A day is Qwen era only if Qwen answered at least one live message. A cap set on a day it
    # answered nothing (2026-11-08: Minnie unreachable, 0 of 2) would credit Qwen with Haiku's cost.
    qdays = {d for d in qwen_run_days() if t_share.get(d, {}).get("answered", 0) > 0}
    agree, clean = tag_accuracy()
    t_agree, t_clean = triage_accuracy(len(lat))
    pre = [v for d, v in c.items() if d not in qdays]
    post = [v for d, v in c.items() if d in qdays]
    avg = lambda vs: (round(sum(v["usd"] for v in vs) / max(sum(v["runs"] for v in vs), 1), 4) if vs else None)
    pctl = lambda p: (lat[min(int(len(lat) * p), len(lat) - 1)] if lat else None)
    wf = workflows()
    return {
        "schema": 1,
        "model": "qwen3-coder:30b",
        # When these aggregates were read from the logs (UTC). /qwen/ shows it as "Data as of" (site#60).
        # QWEN_AS_OF pins it for tests.
        "as_of": os.environ.get("QWEN_AS_OF") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "share_by_day": {"triage": series(t_share), "issue-tag": series(i_share)},
        "workflows": wf,
        "calls_by_day": calls_by_day(t_share, i_share, wf, triage_shadow()),
        "fallback_reasons": reasons,
        "cost_per_run": {
            "triage_by_day": [{"day": d, "runs": c[d]["runs"], "usd_per_run": round(c[d]["usd"] / c[d]["runs"], 4), "qwen_era": d in qdays} for d in sorted(c)],
            "triage_baseline_usd_per_run": avg(pre),
            "triage_qwen_era_usd_per_run": avg(post),
            "issue_tag_usd_per_item": {m: round(v["usd"] / v["items"], 5) for m, v in i_models.items() if v["items"]},
        },
        "latency_ms": {
            "qwen": {"n": len(lat), "p50": pctl(0.5), "p90": pctl(0.9)},
            "haiku": None,  # PENDING: no Haiku latency is logged yet
        },
        "breakdowns": {
            "by_workflow": {w: {"answered": sum(r["answered"] for r in s), "fell_back": sum(r["fell_back"] for r in s), "capped": sum(r["capped"] for r in s)}
                            for w, s in (("triage", series(t_share)), ("issue-tag", series(i_share)))}
                           | {w: {"answered": v["answered"], "fell_back": v["fell_back"], "capped": v["capped"]} for w, v in wf.items()},
            "by_tool_call": {"qwen_classify": len(lat)},
            "by_task_label": labels,
        },
        # Pre-production trial (pedal#569), correct answers out of 4. Labelled as a trial on the page.
        "accuracy": {
            "trial": {"label": "Pre-production trial, 4 items", "correct_of_4": {"haiku": 3, "qwen": 2, "sonnet": 1}},
            # issue-tag from skill-library#561 rows, triage from mycroft#670 rows. null = rows not landed.
            "shadow_agreement_pct": {"triage": t_agree, "issue-tag": agree},
            "correction_free_pct": {"triage": t_clean, "issue-tag": clean},
            "pending": {  # each workflow points at the issue that feeds it
                "shadow_agreement_pct": {"triage": "mycroft#668", "issue-tag": "skill-library#561"},
                "correction_free_pct": {"triage": "mycroft#668", "issue-tag": "skill-library#561"},
            },
        },
    }


if __name__ == "__main__":
    json.dump(build(), sys.stdout, indent=1, sort_keys=True)
    print()
