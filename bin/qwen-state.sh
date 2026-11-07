#!/usr/bin/env bash
# qwen-state.sh — writes the aggregates-only Qwen rollout JSON the /qwen/ page is built from, to
# content/qwen/data.json (public page: bin/qwen-state.py whitelists every field; test/qwen-state.test.mjs checks it).
# Usage: bin/qwen-state.sh        Then: node build.mjs
set -uo pipefail
cd "$(dirname "$0")/.."
OUT="content/qwen/data.json"; LOG="bin/qwen-state.log"
mkdir -p content/qwen
python3 bin/qwen-state.py > "$OUT.tmp" 2> "$OUT.err"; rc=$?
[ "$rc" = 0 ] && mv "$OUT.tmp" "$OUT" || rm -f "$OUT.tmp"
printf '[%s] argv=[%s] exit=%s out=%s err="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" "$rc" "$OUT" "$(tr '\n' ' ' < "$OUT.err" | cut -c1-200)" >> "$LOG"
rm -f "$OUT.err"
[ "$rc" = 0 ] && echo "$OUT"
exit "$rc"
