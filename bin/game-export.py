#!/usr/bin/env python3
"""game-export.py: Qwen game ledger -> one JSON document on stdout (exporter for /fleet/game/).
Reads (never writes) Anansi's files: points.jsonl, game/rounds.jsonl, game/rules.md, game/learnings.md.
  GAME_STATE_DIR  where they live (default ~/.local/state/anansi); points.jsonl sits in it, the rest in game/.
Only the stable row fields are carried; any extra field is dropped. A bad line is skipped and named on stderr.
Output is real ledger data: it goes to KV (bin/game-kv.sh), never into this public repo.
"""
import json, os, sys
from datetime import datetime, timezone

ROOT = os.path.expanduser(os.environ.get("GAME_STATE_DIR", "~/.local/state/anansi"))
EVENT = ("ts", "round", "rules", "agent", "event", "points", "usd", "evidence", "lesson")
ROUND = ("round", "start", "end", "rules", "game_usd", "learnings")


def rows(path):
    out = []
    try:
        fh = open(path, encoding="utf-8")
    except OSError:
        print(f"game-export: {path} unreadable, treated as empty", file=sys.stderr)
        return out
    with fh:
        for n, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                r = json.loads(line)
                if not isinstance(r, dict):
                    raise ValueError("not an object")
                out.append(r)
            except ValueError:
                print(f"game-export: {path}:{n} skipped (bad JSON)", file=sys.stderr)
    return out


def text(path):
    try:
        return open(path, encoding="utf-8").read()
    except OSError:
        return ""


def build(root=ROOT):
    rounds = {}
    for r in rows(os.path.join(root, "game", "rounds.jsonl")):
        if isinstance(r.get("round"), int):
            rounds[r["round"]] = {**{k: r.get(k) for k in ROUND}, "events": []}
    totals = {}
    for e in rows(os.path.join(root, "points.jsonl")):
        if not isinstance(e.get("round"), int) or not isinstance(e.get("agent"), str):
            continue
        ev = {k: e.get(k) for k in EVENT}
        ev["points"] = ev["points"] if isinstance(ev["points"], (int, float)) else 0
        ev["usd"] = ev["usd"] if isinstance(ev["usd"], (int, float)) else 0
        rd = rounds.setdefault(e["round"], {**{k: None for k in ROUND}, "round": e["round"], "learnings": [], "events": []})
        rd["events"].append(ev)
        totals[e["agent"]] = totals.get(e["agent"], 0) + ev["points"]
    ordered = [rounds[k] for k in sorted(rounds, reverse=True)]
    for rd in ordered:
        rd["events"].sort(key=lambda x: x.get("ts") or "")
    return {
        "schema": "game-state/1",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rules_md": text(os.path.join(root, "game", "rules.md")),
        "learnings_md": text(os.path.join(root, "game", "learnings.md")),
        "rounds": ordered,
        "totals": dict(sorted(totals.items(), key=lambda kv: -kv[1])),
    }


if __name__ == "__main__":
    json.dump(build(), sys.stdout, ensure_ascii=False, indent=1)
    print()
