#!/usr/bin/env bash
# fleet-state.sh — writes the live fleet state the /fleet/ scene renders from, to
# ~/.local/state/fleet-scene/state.json (never inside the repo: it names clients and cards).
# Usage: bin/fleet-state.sh [--mask] [--no-gh]     Then: FLEET_STATE=~/.local/state/fleet-scene/state.json bin/fleet-build.sh --snap
set -uo pipefail
cd "$(dirname "$0")/.."
OUT_DIR="$HOME/.local/state/fleet-scene"; OUT="$OUT_DIR/state.json"; LOG="bin/fleet-state.log"
umask 077; mkdir -p "$OUT_DIR"
python3 bin/fleet-state.py "$@" > "$OUT.tmp" 2> "$OUT.err"; rc=$?
[ "$rc" = 0 ] && mv "$OUT.tmp" "$OUT" || rm -f "$OUT.tmp"
printf '[%s] argv=[%s] exit=%s out=%s err="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" "$rc" "$OUT" "$(tr '\n' ' ' < "$OUT.err" | cut -c1-200)" >> "$LOG"
rm -f "$OUT.err"
[ "$rc" = 0 ] && echo "$OUT"
exit "$rc"
