#!/usr/bin/env bash
# qwen-refresh.sh — snapshot a fresh origin/main, generate content/qwen/data.json from the live sources, privacy-gate it, and run
# the site build. It NEVER deploys (site#78): /qwen/ data now reaches the page through KV (bin/qwen-kv.sh, every 10 minutes),
# and site deploys are a separate, merge-gated step. Kept as a build check; its plist was removed, so nothing schedules it.
# Long name: qwen-page-refresh-build-check.
#   bin/qwen-refresh.sh              generate, privacy gate, build, print the /fleet/ pages  (--no-deploy is accepted and ignored)
# Steps: 1 snapshot a fresh origin/main (git archive)  2 qwen-state.py -> data.json inside it
#        3 privacy gate: bin/qwen-leakcheck.py on data.json -> any hit exits 1
#        4 bin/site-build.sh in the snapshot (npm build + the four /fleet/ pages; any failure exits 1).
# Never committed: data.json is built from counts only (qwen-state.py whitelist); email-derived rows never leave the Air.
# Env (tests/overrides): QWEN_REFRESH_REF (default origin/main), QWEN_REFRESH_DATA (use this file instead of running
#   qwen-state.py), plus qwen-state.py's own QWEN_* sources.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"; LOG="bin/qwen-refresh.log"
REF="${QWEN_REFRESH_REF:-origin/main}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
umask 077
SNAP=$(mktemp -d); trap 'rm -rf "$SNAP"' EXIT
ARGV="$*"; fin() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGV" "$rc" "$2" >> "$LOG"; echo "$2"; exit "$rc"; }

[ "$REF" = origin/main ] && { git fetch -q origin main || fin 1 "git fetch origin main failed"; }
git archive "$REF" | tar -x -C "$SNAP" || fin 1 "snapshot of $REF failed"

if [ -n "${QWEN_REFRESH_DATA:-}" ]; then cp "$QWEN_REFRESH_DATA" "$SNAP/content/qwen/data.json" || fin 1 "cannot read QWEN_REFRESH_DATA"
else python3 "$SNAP/bin/qwen-state.py" > "$SNAP/data.new" 2> "$SNAP/data.err" || fin 1 "qwen-state.py failed: $(tr '\n' ' ' < "$SNAP/data.err" | cut -c1-160)"
  mv "$SNAP/data.new" "$SNAP/content/qwen/data.json"; fi
DATA="$SNAP/content/qwen/data.json"
jq -e 'type=="object"' "$DATA" > /dev/null 2>&1 || fin 1 "data.json is not a JSON object"

SUM=$(shasum -a 256 "$DATA" | cut -d' ' -f1)

why=$(python3 "$SNAP/bin/qwen-leakcheck.py" < "$DATA" 2>&1) || fin 1 "PRIVACY GATE BLOCKED (${SUM:0:12}): $why"
bout=$("$SNAP/bin/site-build.sh" 2>&1) || fin 1 "site build failed: $(echo "$bout" | tail -n 3 | tr '\n' ' ' | cut -c1-200)"
FLEETLS=$(cd "$SNAP/dist/fleet" && find . -name '*.html' | sort | tr '\n' ' ')
echo "dist/fleet: $FLEETLS"
fin 0 "built (${SUM:0:12}); privacy gate clean; --no-deploy, not deployed"
