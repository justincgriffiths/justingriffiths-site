#!/usr/bin/env python3
"""qwen-tests.py: aggregate completion-test result files into content/qwen/tests.json (public: counts only).

Inputs (JSON lines, written by the test scripts in the session that runs them):
  QWEN_TEST_REPLAY  replay.jsonl   one row per replayed issue: {qwen, haiku, today} label maps (repo and number are dropped here)
  QWEN_TEST_TABLE   testB.jsonl    one row per attempt at the fill-a-table test: {rows, rep, cells_ok, cells, exact, unparseable}
  QWEN_TEST_AUDIT   cos/runs/*.audit.jsonl   triage shadow rows (qwen_pair): the two labels are counted, nothing else is read
Output: tests.json on stdout (or --out FILE). Exit 0 with a file per input found; 2 when none was found.
No repo name, issue number, title or message text is ever read into the output.
  python3 -I bin/qwen-tests.py --out content/qwen/tests.json
"""
import argparse, collections, datetime, glob, json, os, sys

DIR = os.path.expanduser("~/.claude/jobs/aa489be1/tmp")
AUDIT = os.environ.get("QWEN_TEST_AUDIT", os.path.expanduser("~/worktrees/mycroft/live/cos/runs/*.audit.jsonl"))
REPLAY = os.environ.get("QWEN_TEST_REPLAY", f"{DIR}/replay.jsonl")
TABLE = os.environ.get("QWEN_TEST_TABLE", f"{DIR}/testB.jsonl")
# cheapest to costliest. "human" is not a model, so it never counts as cheaper or costlier.
SCALE = {"rung:free": 0, "rung:script": 1, "rung:haiku": 2, "rung:sonnet": 3, "rung:opus": 4}
DIMS = ["type", "priority", "audience", "rung"]


def rows(path):
    if not os.path.exists(path):
        return None
    out = []
    for line in open(path):
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    return out


def replay(rs):
    seen, uniq = set(), []
    for r in rs:  # the same issue replayed twice counts once (the last answer wins)
        k = json.dumps([r.get("repo"), r.get("number")])
        if k in seen:
            uniq = [u for u in uniq if json.dumps([u.get("repo"), u.get("number")]) != k]
        seen.add(k)
        uniq.append(r)
    dims = {}
    for dim in DIMS:
        h = t = hn = tn = 0
        for r in uniq:
            q, hh, tt = (r.get(x) or {} for x in ("qwen", "haiku", "today"))
            if dim in q and dim in hh:
                hn += 1; h += q[dim] == hh[dim]
            if dim in q and dim in tt:
                tn += 1; t += q[dim] == tt[dim]
        dims[dim] = {"vs_haiku": {"n": hn, "agree": h}, "vs_today": {"n": tn, "agree": t}}
    rung = {}
    for other in ("haiku", "today"):
        c = collections.Counter()
        for r in uniq:
            q, o = (r.get("qwen") or {}).get("rung"), (r.get(other) or {}).get("rung")
            if q is None or o is None:
                continue
            if q not in SCALE or o not in SCALE:
                c["not_comparable"] += 1
            else:
                c["cheaper" if SCALE[q] < SCALE[o] else "costlier" if SCALE[q] > SCALE[o] else "same"] += 1
        rung[f"vs_{other}"] = {k: c.get(k, 0) for k in ("cheaper", "same", "costlier", "not_comparable")}
    dist = {}
    for who in ("qwen", "haiku", "today"):
        c = collections.Counter(((r.get(who) or {}).get("rung") or "none").replace("rung:", "") for r in uniq)
        dist[who] = dict(sorted(c.items()))
    return {"replayed": len(uniq), "by_field": dims, "rung_vs": rung, "rung_counts": dist}


def shadow(paths):
    """Triage shadow pairs: Qwen's label next to Haiku's, from the cos audit rows. Reads the two labels only."""
    c, missing = collections.Counter(), 0
    for p in paths:
        for r in rows(p) or []:
            if r.get("tool") != "qwen_pair":
                continue
            if r.get("qwen_label") and r.get("haiku_label"):
                c[(r["qwen_label"], r["haiku_label"])] += 1
            else:
                missing += 1  # a pair row where one side has no label: counted here, not in the matrix
    if not c:
        return None
    return {"total": sum(c.values()), "missing_label": missing, "agree": sum(n for (q, h), n in c.items() if q == h),
            "counts": [[q, h, n] for (q, h), n in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))]}


def table(rs):
    by = collections.defaultdict(list)
    for r in rs:
        by[int(r["rows"])].append(r)
    out = []
    for n in sorted(by):
        a = by[n]
        out.append({"rows": n, "cells": a[0]["cells"], "attempts": len(a), "cells_correct": [x["cells_ok"] for x in a],
                    "exact": sum(1 for x in a if x.get("exact")), "unparseable": sum(1 for x in a if x.get("unparseable"))})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    a = ap.parse_args()
    rp, tb = rows(REPLAY), rows(TABLE)
    if rp is None and tb is None:
        print("qwen-tests: no result files found", file=sys.stderr)
        return 2
    doc = {"schema": 1, "as_of": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "model": "qwen3-coder:30b",
           "label_replay": replay(rp) if rp else None, "fill_table": table(tb) if tb else None,
           "triage_shadow": shadow(sorted(glob.glob(AUDIT)))}
    text = json.dumps(doc, indent=2) + "\n"
    if a.out:
        with open(a.out, "w") as f:
            f.write(text)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
