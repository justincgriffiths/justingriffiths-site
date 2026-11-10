#!/usr/bin/env python3
"""truth-history.py — rebuild "was there work" for past session-finish and declutter-sweep runs from the Claude transcripts (site#119).

Two steps, each its own subcommand, each bounded:
  index --limit N   read N not-yet-indexed transcripts (default 100) and append one compact record each to the session index (JSONL, outside the repo).
                    The record holds only: a short session id, the session kind, first/last event time, name CLASSES over proven time brackets (AGT / not AGT),
                    and the idle intervals. No name, no message text, no cwd is stored: a transcript line is parsed, three fields are read, the rest is dropped.
  runs              for every non-dry run in the session-finish and sweep logs, reconstruct work_existed by the job's own definition and write one row per run
                    to the truth-history file (ts, job, work_existed 1/0/unknown, n_idle, method), counts and short ids only.

The job's own definition (session-finish/plan.py, agt-ledger.py): idle = a session named AGT_ at that time, not live (state not working, tempo idle), and not handled in the last 24h (the back-off, from handled.tsv). The
daemon's tempo is not in a transcript, so it is approximated by the turn boundary: a session is idle from a turn_duration record until the next user,
assistant or scheduled_task_fire record. Paths: QWEN_TRUTH_SESSIONS (index), QWEN_TRUTH_HISTORY (output), QWEN_TRANSCRIPTS (default ~/.claude/projects).
Usage: bin/truth-history.py index --limit 1 | runs [--limit N]
"""
import argparse, glob, hashlib, json, os, re, sys
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
ROOT = os.environ.get("QWEN_TRANSCRIPTS", f"{HOME}/.claude/projects")
INDEX = os.environ.get("QWEN_TRUTH_SESSIONS", f"{HOME}/.local/state/qwen/truth-sessions.jsonl")
OUT = os.environ.get("QWEN_TRUTH_HISTORY", f"{HOME}/.local/state/qwen/truth-history.jsonl")
NEUTRAL = {"turn_duration", "stop_hook_summary", "away_summary", "informational", "local_command", "compact_boundary"}


def h10(x):
    """A name or a directory is kept as a 10-hex hash, only to test two sessions for equality. Never the text."""
    return hashlib.sha1(str(x).encode()).hexdigest()[:10]


def ts_of(s):
    return datetime.fromisoformat(str(s).replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def index_file(path):
    """One transcript -> one compact record. Reads type, timestamp, subtype, sessionKind and customTitle's class; keeps nothing else."""
    first = last = kind = cwd = None
    prev_ts = None; pend = []         # title classes seen since the last timestamped record, each waiting for its upper bound
    titles = []                      # [class, lo, hi]: the title was set between two timestamped records
    idle_from, idle = None, []
    for line in open(path, errors="replace"):
        try: d = json.loads(line)
        except ValueError: continue
        t = d.get("type")
        if t == "custom-title":
            pend.append(["A" if str(d.get("customTitle") or "").startswith("AGT_") else "N", prev_ts, h10(d.get("customTitle") or "")]); continue
        if not d.get("timestamp"): continue
        try: ts = ts_of(d["timestamp"])
        except ValueError: continue
        for cls, lo, h in pend: titles.append([cls, lo, ts, h])
        pend = []; prev_ts = ts
        if cwd is None and d.get("cwd"): cwd = h10(d["cwd"])
        first = first or ts; last = max(last or ts, ts); kind = kind or d.get("sessionKind")
        sub = d.get("subtype")
        if t == "system" and sub == "turn_duration":
            idle_from = idle_from or ts
        elif t in ("user", "assistant") or (t == "system" and sub == "scheduled_task_fire"):
            if idle_from: idle.append([idle_from, ts]); idle_from = None
    for cls, lo, h in pend: titles.append([cls, lo, None, h])
    if idle_from: idle.append([idle_from, None])   # idle to the end of the transcript
    return {"sid": os.path.basename(path)[:8], "kind": kind, "first": first, "last": last, "titles": titles, "idle": idle, "cwd": cwd,
            "file": os.path.basename(os.path.dirname(path)) + "/" + os.path.basename(path), "size": os.path.getsize(path)}


def indexed():
    done = set()
    try:
        for l in open(INDEX): done.add(json.loads(l)["file"])
    except OSError: pass
    return done


def cmd_index(a):
    done = indexed()
    todo = [p for p in sorted(glob.glob(f"{ROOT}/*/*.jsonl")) if os.path.basename(os.path.dirname(p)) + "/" + os.path.basename(p) not in done][:a.limit]
    os.makedirs(os.path.dirname(INDEX), exist_ok=True)
    with open(INDEX, "a") as f:
        for p in todo: f.write(json.dumps(index_file(p)) + "\n")
    print(f"indexed {len(todo)} transcripts, {len(done) + len(todo)} in the index, {len(glob.glob(f'{ROOT}/*/*.jsonl')) - len(done) - len(todo)} left")


# ---- reconstruction ---------------------------------------------------------------------------------------------------------------------------------
LEDGER = os.environ.get("QWEN_AGT_LEDGER_LOG", f"{HOME}/.local/state/finish-sessions/agt-ledger.log")
FINISH = os.environ.get("QWEN_SESSION_FINISH", f"{HOME}/.local/state/session-finish/session-finish.log")
HANDLED = os.environ.get("QWEN_HANDLED", f"{HOME}/.local/state/session-finish/handled.tsv")
SWEEP = os.environ.get("QWEN_DECLUTTER_SWEEP", f"{HOME}/.local/state/declutter-sweep/sweep.log")


def name_info(titles, t):
    """(class, hash) of the session's name at time t. class: "A" (AGT_), "N" (any other name), None (not named yet), or "?" when it cannot be proven.
    hash: the name's 10-hex hash when the name itself is proven (the same title in every case that may be in force), else None.
    A title record has no timestamp; it was written between the timestamped records either side of it, so it was in force by `hi` and not before `lo`.
    The latest title with hi <= t is in force unless a later title may already have been written (lo <= t < hi); then the class is proven only if they agree."""
    done = [x for x in titles if x[2] is not None and x[2] <= t]
    later = [x for x in titles[len(done):] if x[1] is None or x[1] <= t]
    if not done and not later: return None, None
    cand = ([done[-1]] if done else []) + later
    classes = {x[0] for x in cand}; names = {x[3] if len(x) > 3 else None for x in cand}
    return (classes.pop() if len(classes) == 1 else "?"), (names.pop() if len(names) == 1 else None)


def name_class(titles, t):
    return name_info(titles, t)[0]


def state_at(rec, t):
    """For one session at time t: (class, where) where where is "idle" or "busy" inside the transcript, "post" after its last record (still present
    or deleted, unprovable), or "pre" before its first record."""
    if not rec["first"] or rec["first"] > t: return None, "pre"
    cls = name_class(rec["titles"], t)
    if rec["last"] and t > rec["last"]: return cls, "post"
    for a, b in rec["idle"]:
        if a <= t and (b is None or t < b): return cls, "idle"
    return cls, "busy"


def reconstruct(t, sessions):
    """work_existed by the job's own definition (plan.py: name AGT_, not live, idle), from the transcripts. A background session (sessionKind bg) is a candidate.
    n_idle = sessions proven AGT_ and idle at t. n_unproven = sessions that might have been AGT_ and idle (name unprovable, or present after their last record,
    where a deletion cannot be seen). work_existed = 1 if n_idle > 0; 0 if nothing could have been idle; otherwise unknown. Returns (work, n_idle, n_unproven, idle_ids)."""
    idle, unproven = [], 0
    for r in sessions:
        if r["kind"] != "bg": continue
        cls, where = state_at(r, t)
        if where == "pre" or cls in (None, "N"): continue
        if where == "idle" and cls == "A": idle.append(r["sid"])
        elif where == "busy" and cls in ("A", "?"): continue          # working: not idle by the job's definition
        else: unproven += 1                                           # name "?" or present after its last record
    work = 1 if idle else 0 if not unproven else None
    return work, len(idle), unproven, sorted(idle)


CLAIM_WINDOW = 120   # seconds. the review of the unexplained runs saw 17s (re-claim 11:38:31Z, new transcript 11:38:48Z); 120s is about seven times that, and a claim hours earlier (10-12: 3h) cannot link.
DAEMON_LOG = os.environ.get("QWEN_DAEMON_LOG", f"{HOME}/.claude/daemon.log")


def daemon_claims():
    """{short job id: [claim time, ...]} from daemon.log lines "bg claimed-spare <id> (...)": the daemon handing a job to a new process."""
    out = {}
    try:
        for line in open(DAEMON_LOG, errors="replace"):
            m = re.match(r"\[(\S+Z)\] \[bg\] bg claimed-spare ([0-9a-f]{8})\b", line)
            if m: out.setdefault(m[2], []).append(m[1])
    except OSError: pass
    return out


def link_handled(rec, ts, by_sid, handled_ids, claims):
    """The handled.tsv job id a continued session belongs to, or None. A continued session gets a new transcript id while handled.tsv holds the job's older id.
    Linked only when all three agree for exactly one handled id H, an older transcript: (1) the name in force at ts is the same, proven on both sides; (2) the
    project directory is the same; (3) daemon.log shows H claimed in the CLAIM_WINDOW seconds before this transcript's first record. Any missing or more than
    one candidate: not linked. This is inference, so every row that uses a link says link=inferred."""
    if not rec.get("cwd") or not rec.get("first"): return None
    cls, nh = name_info(rec["titles"], ts)
    if cls != "A" or nh is None: return None
    t0 = datetime.fromisoformat(rec["first"].replace("Z", "+00:00"))
    hits = []
    for hid in handled_ids:
        o = by_sid.get(hid)
        if not o or o["sid"] == rec["sid"] or not o.get("first") or o["first"] >= rec["first"] or o.get("cwd") != rec["cwd"]: continue
        ocls, oh = name_info(o["titles"], ts)
        if ocls != "A" or oh != nh: continue
        if any(0 <= (t0 - datetime.fromisoformat(c.replace("Z", "+00:00"))).total_seconds() <= CLAIM_WINDOW for c in claims.get(hid, [])): hits.append(hid)
    return hits[0] if len(hits) == 1 else None


def load_sessions():
    return [json.loads(l) for l in open(INDEX)]


def log_runs(path, dry):
    for line in open(path):
        m = re.match(r"\[(\d{4}-\d{2}-\d{2}T[\d:]+Z)\]", line)
        if m and not re.search(r"status=(dry|dry-run)\b|--dry-run", line): yield m[1], line


def ledger_calls():
    out = []
    for line in open(LEDGER):
        m = re.match(r"\[(\S+Z)\] argv=(.*) exit=\d+ sessions=(\d+) live=(\d+)", line)
        if m: out.append((m[1], "--json" in m[2], int(m[3]), int(m[4])))
    return out


def match_ledger(ts, calls):
    """The ledger call session-finish made for this run: the latest `--json` call in the 180 seconds before the run's log line (the wrapper reads the ledger,
    plans, then logs). None if there is none: an ad-hoc call (`--md`, `--status all`, `--id`) is not matched."""
    t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    best = None
    for cts, js, n, live in calls:
        d = (t - datetime.fromisoformat(cts.replace("Z", "+00:00"))).total_seconds()
        if js and 0 <= d <= 180 and (best is None or d < best[0]): best = (d, cts, n, live)
    return best


def own_claim(line):
    """What the run's own line says, numbers only. idle_agt=K is the field itself (the finish log's ground-truth fields), counted before the 24h back-off. Older lines: a clean
    line says no AGT_ session was eligible (0 picked), an apply line "N session(s)" picked N. A clean line's "(B busy, H handled <24h)" is the job's own account of
    why it was quiet: H sessions were in the 24h back-off. Returns (sessions the job says it worked or saw to work, which field, H or None)."""
    h = re.search(r"\((\d+) busy, (\d+) handled <24h\)", line)
    h = int(h[2]) if h else None
    m = re.search(r"idle_agt=(\d+)", line)
    if m: return int(m[1]), "idle_agt", h
    if "status=clean" in line: return 0, "clean", h
    m = re.search(r"(\d+) session\(s\)", line)
    if m: return int(m[1]), "planned", h
    return None, "none", h


def handled_rows():
    """[(time, short session id)] from session-finish's handled.tsv: the 24h back-off list the job itself keeps (plan.py handled_recently)."""
    out = []
    try:
        for line in open(HANDLED):
            p = line.rstrip("\n").split("\t")
            if len(p) >= 2: out.append((p[0], p[1][:8]))
    except OSError: pass
    return out


def backed_off(ts, handled):
    """Short ids handled in the 24h before ts: skipped by the job on purpose (plan.py: now - handled < 24h)."""
    t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return {sid for hts, sid in handled if 0 < (t - datetime.fromisoformat(hts.replace("Z", "+00:00"))).total_seconds() < 86400}


def decide(ts, job, sessions, led, handled=(), claims=None):
    """One row for a run. Ground truth by the job's own definition (idle = named AGT_, not live, tempo idle), in this order:
      ledger: the agt-ledger call the run made counted no non-live AGT_ session (sessions - live == 0): nothing could be idle, work_existed 0.
      transcript: a background session proven named AGT_ at ts and idle at ts (a turn ended, no later user or assistant record yet): 1 for session-finish. The
              sweep also needs the session mechanically clean, which a transcript cannot show, so the sweep is never 1 from here.
      otherwise unknown: non-live sessions existed but idle against blocked, or a name, is unprovable.
    Every transcript-derived method ends in backoff=job-rule: the 24h back-off follows the job's own rule (Justin, 2026-11-09). The back-off is a switch, both
    answers kept: work_existed (the job's rule: a session handled in the last 24h is skipped on purpose, so it is not work) and work_existed_b (back-off sessions
    count as work). A session is backed off when its own short id, or the handled.tsv id it is linked to (link_handled, inferred), was handled in the last 24h;
    a row that relies on a link says link=inferred. Under the job's rule a run whose every proven idle session is backed off is 0 only when every non-live
    session in the ledger is one of those proven idle ones; otherwise unknown. n_idle = proven idle by transcript (a lower bound); n_eligible = those not backed
    off; n_nonlive = the ledger's sessions - live, or None when no ledger call matches. `links` lists (transcript id, handled id) pairs used; never in the file."""
    work, n_idle, _, ids = reconstruct(ts, sessions)
    nonlive = None if led is None else led[2] - led[3]
    base = {"n_idle": n_idle, "n_eligible": n_idle, "n_nonlive": nonlive, "ids": ids, "links": []}
    if nonlive == 0: return {**base, "n_idle": 0, "n_eligible": 0, "work_existed": 0, "work_existed_b": 0, "method": "ledger", "ids": []}
    if work == 1 and job == "session-finish":
        off = backed_off(ts, handled); by_sid = {r["sid"]: r for r in sessions}; hids = sorted({sid for _, sid in handled})
        elig, links = [], []
        for i in ids:
            if i in off: continue
            hid = link_handled(by_sid[i], ts, by_sid, hids, claims or {}) if i in by_sid else None
            if hid is not None and hid in off: links.append((i, hid)); continue
            elig.append(i)
        base["n_eligible"] = len(elig); base["links"] = links
        tag = ";link=inferred" if links else ""
        if elig: return {**base, "work_existed": 1, "work_existed_b": 1, "method": "transcript;backoff=job-rule" + tag}
        a = 0 if nonlive is not None and nonlive <= len(ids) else None
        return {**base, "work_existed": a, "work_existed_b": 1, "method": ("transcript+backoff;backoff=job-rule" if a == 0 else "unproven;backoff=job-rule") + tag}
    return {**base, "work_existed": None, "work_existed_b": None, "method": "unproven"}


def rows_for(paths_job, sessions, calls, handled, claims):
    for job, path in paths_job:
        for ts, line in log_runs(path, False):
            led = match_ledger(ts, calls); own, src, h = own_claim(line)
            yield {"ts": ts, "job": job, **decide(ts, job, sessions, led, handled, claims), "own": own, "own_from": src, "own_backoff": h}


def cmd_runs(a):
    sessions, calls = load_sessions(), ledger_calls()
    rows = sorted(rows_for([("session-finish", FINISH), ("declutter-sweep", SWEEP)], sessions, calls, handled_rows(), daemon_claims()), key=lambda r: (r["ts"], r["job"]))
    if a.only: rows = [r for r in rows if r["ts"] == a.only]
    elif a.stride: rows = rows[::a.stride]
    rows = rows[: a.limit] if a.limit else rows
    if a.write:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w") as f:
            for r in rows: f.write(json.dumps({k: r[k] for k in ("ts", "job", "work_existed", "work_existed_b", "n_idle", "n_eligible", "n_nonlive", "method")}) + "\n")
    for r in rows: print(json.dumps(r))


def main():
    ap = argparse.ArgumentParser(); sp = ap.add_subparsers(dest="cmd", required=True)
    i = sp.add_parser("index"); i.add_argument("--limit", type=int, default=100)
    r = sp.add_parser("runs"); r.add_argument("--only"); r.add_argument("--limit", type=int); r.add_argument("--stride", type=int); r.add_argument("--write", action="store_true")
    a = ap.parse_args()
    {"index": cmd_index, "runs": cmd_runs}[a.cmd](a)


if __name__ == "__main__":
    main()
