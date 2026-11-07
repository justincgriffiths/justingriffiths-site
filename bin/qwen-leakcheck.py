#!/usr/bin/env python3
"""qwen-leakcheck.py — filter: reads the /qwen/ data.json on stdin; exit 0 = clean, exit 1 = a per-message field is present.

The privacy gate for bin/qwen-refresh.sh. Same rules as test/qwen-state.test.mjs: no forbidden key anywhere,
no "@", no id/title/subject word. Prints the reason (a key name or a rule), never the offending value.
"""
import json, re, sys

FORBIDDEN_KEYS = {"id", "ids", "subject", "sender", "from", "title", "number", "repo", "account", "labels", "pair", "haiku_add",
                  "dimension", "to", "model_of_origin", "applied_at", "qwen_label", "haiku_label", "from_label", "to_label",
                  "issue", "match", "haiku_usd", "context", "input", "message_id", "email", "report"}


def keys(o, acc):
    if isinstance(o, dict):
        for k, v in o.items(): acc.add(k); keys(v, acc)
    elif isinstance(o, list):
        for v in o: keys(v, acc)
    return acc


raw = sys.stdin.read()
try:
    hit = sorted(keys(json.loads(raw), set()) & FORBIDDEN_KEYS)
except ValueError:
    print("not JSON", file=sys.stderr); sys.exit(1)
if hit: print("forbidden key: " + ",".join(hit), file=sys.stderr); sys.exit(1)
if "@" in raw: print("an @ is present", file=sys.stderr); sys.exit(1)
if re.search(r'"id"|title|subject', raw): print("id/title/subject text is present", file=sys.stderr); sys.exit(1)
