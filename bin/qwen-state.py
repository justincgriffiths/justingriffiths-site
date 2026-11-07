#!/usr/bin/env python3
"""qwen-state.py — filter: reads the Qwen rollout sources, prints ONE aggregates-only JSON to stdout.

PUBLIC page. The output is built from a whitelist: every value is a count, a sum, a date bucket or a
fixed category name. Nothing is copied from a source row, so a new per-message field upstream can't leak.
Never exported: message ids, subjects, senders, issue titles, issue numbers, repo names, accounts.

Sources (override with env for tests): QWEN_RUNS (cos/runs dir), QWEN_COST_DB (cos/state/cost.db),
QWEN_TAG_LOG / QWEN_TAG_JSONL (skill-library write-work-items/scripts/issue-tag.{log,jsonl}).
Usage: bin/qwen-state.py [--now ISO]
"""
import glob, json, os, re, sqlite3, sys
from collections import defaultdict

HOME = os.path.expanduser("~")
RUNS = os.environ.get("QWEN_RUNS", f"{HOME}/worktrees/mycroft/live/cos/runs")
COST_DB = os.environ.get("QWEN_COST_DB", f"{HOME}/worktrees/mycroft/live/cos/state/cost.db")
TAG_DIR = f"{HOME}/worktrees/skill-library/live/write-work-items/scripts"
TAG_LOG = os.environ.get("QWEN_TAG_LOG", f"{TAG_DIR}/issue-tag.log")
TAG_JSONL = os.environ.get("QWEN_TAG_JSONL", f"{TAG_DIR}/issue-tag.jsonl")

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
    try:
        with open(path) as f:
            for line in f:
                try: yield json.loads(line)
                except ValueError: pass
    except OSError:
        return


def day_of_run(path):
    m = re.search(r"(\d{4})(\d{2})(\d{2})-", os.path.basename(path))
    return f"{m[1]}-{m[2]}-{m[3]}" if m else None


def triage():
    share = defaultdict(lambda: {"answered": 0, "fell_back": 0, "capped": 0})
    reasons = {k: 0 for k in REASONS}
    labels = {k: 0 for k in sorted(LABELS) + ["other"]}
    lat = []
    for p in sorted(glob.glob(f"{RUNS}/*.json")):
        try: d = json.load(open(p))
        except (OSError, ValueError): continue
        q = d.get("qwen")
        dy = day_of_run(p)
        if not isinstance(q, dict) or not dy: continue
        seen, ans, esc = int(q.get("seen") or 0), int(q.get("qwen") or 0), int(q.get("escalated") or 0)
        share[dy]["answered"] += ans
        share[dy]["fell_back"] += esc
        share[dy]["capped"] += max(seen - ans - esc, 0)
        for r, n in (q.get("reasons") or {}).items():
            reasons[reason_bucket(r)] += int(n or 0)
    for p in sorted(glob.glob(f"{RUNS}/*.audit.jsonl")):
        for r in rows(p):
            if r.get("tool") != "qwen_classify": continue
            if r.get("escalated"): continue
            lab = r.get("label")
            labels[lab if lab in LABELS else "other"] += 1
            if isinstance(r.get("latency_ms"), (int, float)): lat.append(float(r["latency_ms"]))
    lat.sort()
    return share, reasons, labels, lat


def costs():
    """Per day: usd per run for triage, split Qwen-era (any run whose sidecar logged qwen) vs before."""
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
    return {day_of_run(p) for p in glob.glob(f"{RUNS}/*.json")
            if isinstance(_load(p).get("qwen"), dict)}


def _load(p):
    try: return json.load(open(p))
    except (OSError, ValueError): return {}


def issue_tag():
    share = defaultdict(lambda: {"answered": 0, "fell_back": 0, "capped": 0})
    for line in open(TAG_LOG) if os.path.exists(TAG_LOG) else []:
        m = re.match(r"\[(\d{4}-\d{2}-\d{2})T", line)
        if not m: continue
        q = re.search(r"qwen_used=(\d+)", line); f = re.search(r"fallback_to_haiku=(\d+)", line); h = re.search(r"haiku_direct=(\d+)", line)
        if not q: continue
        share[m[1]]["answered"] += int(q[1])
        share[m[1]]["fell_back"] += int(f[1]) if f else 0
        share[m[1]]["capped"] += int(h[1]) if h else 0
    models, per_run_cost = defaultdict(lambda: {"items": 0, "usd": 0.0}), 0
    for r in rows(TAG_JSONL):
        m = "qwen" if "qwen" in str(r.get("model", "")).lower() else "haiku"
        models[m]["items"] += 1
        models[m]["usd"] += float(r.get("cost_usd") or 0)
    return share, models


def series(share):
    return [{"day": d, **share[d]} for d in sorted(share)]


def build():
    t_share, reasons, labels, lat = triage()
    i_share, i_models = issue_tag()
    c = costs()
    qdays = qwen_run_days()
    pre = [v for d, v in c.items() if d not in qdays]
    post = [v for d, v in c.items() if d in qdays]
    avg = lambda vs: (round(sum(v["usd"] for v in vs) / max(sum(v["runs"] for v in vs), 1), 4) if vs else None)
    pctl = lambda p: (lat[min(int(len(lat) * p), len(lat) - 1)] if lat else None)
    return {
        "schema": 1,
        "model": "qwen3-coder:30b",
        "share_by_day": {"triage": series(t_share), "issue-tag": series(i_share)},
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
                            for w, s in (("triage", series(t_share)), ("issue-tag", series(i_share)))},
            "by_tool_call": {"qwen_classify": len(lat)},
            "by_task_label": labels,
        },
        # Pre-production trial (pedal#569), correct answers out of 4. Labelled as a trial on the page.
        "accuracy": {
            "trial": {"label": "Pre-production trial, 4 items", "correct_of_4": {"haiku": 3, "qwen": 2, "sonnet": 1}},
            # SLOT: mycroft#668 (shadow pairs) and skill-library#560 (corrections) fill these. null = not landed.
            "shadow_agreement_pct": {"triage": None, "issue-tag": None},
            "correction_free_pct": {"triage": None, "issue-tag": None},
            "pending": {"shadow_agreement_pct": "mycroft#668", "correction_free_pct": "skill-library#560"},
        },
    }


if __name__ == "__main__":
    json.dump(build(), sys.stdout, indent=1, sort_keys=True)
    print()
