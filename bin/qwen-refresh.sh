#!/usr/bin/env bash
# qwen-refresh.sh — regenerate content/qwen/data.json from the live sources and deploy /qwen/ only when it changed.
# Long name: qwen-page-refresh-after-sweep. Runs from launchd (bin/com.justin.qwen-refresh.plist) at 08:10 and 14:10 ET.
#   bin/qwen-refresh.sh              generate, gate, deploy on change        (the loaded job is the only caller that deploys)
#   bin/qwen-refresh.sh --no-deploy  same gates, builds the snapshot, stops before `wrangler deploy`
# Steps: 1 snapshot a fresh origin/main (git archive)  2 qwen-state.py -> data.json inside it
#        3 change gate: same sha256 as the last deploy -> exit 0, nothing deployed
#        4 privacy gate: bin/qwen-leakcheck.py on data.json -> any hit exits 1, nothing deployed
#        5 npx wrangler deploy from the snapshot; on success, record the sha256.
# Never committed: data.json is built from counts only (qwen-state.py whitelist); email-derived rows never leave the Air.
# Env (tests/overrides): QWEN_REFRESH_STATE (state dir), QWEN_REFRESH_REF (default origin/main), QWEN_REFRESH_DATA (use this
#   file instead of running qwen-state.py), plus qwen-state.py's own QWEN_* sources.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD"; LOG="bin/qwen-refresh.log"
STATE="${QWEN_REFRESH_STATE:-$HOME/.local/state/qwen-refresh}"; REF="${QWEN_REFRESH_REF:-origin/main}"
NODEPLOY=0; [ "${1:-}" = "--no-deploy" ] && NODEPLOY=1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p "$STATE"; umask 077
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
[ "$SUM" = "$(cat "$STATE/last-deployed.sha256" 2>/dev/null)" ] && fin 0 "unchanged (${SUM:0:12}); nothing deployed"

why=$(python3 "$SNAP/bin/qwen-leakcheck.py" < "$DATA" 2>&1) || fin 1 "PRIVACY GATE BLOCKED (${SUM:0:12}): $why"
[ "$NODEPLOY" = 1 ] && fin 0 "changed (${SUM:0:12}); privacy gate clean; --no-deploy, not deployed"

(cd "$SNAP" && npx --yes wrangler deploy > "$SNAP/deploy.out" 2>&1) || fin 1 "wrangler deploy failed: $(tail -n 3 "$SNAP/deploy.out" | tr '\n' ' ' | cut -c1-200)"
echo "$SUM" > "$STATE/last-deployed.sha256"
fin 0 "deployed (${SUM:0:12})"
