#!/usr/bin/env bash
# qwen-kv.sh — runs bin/qwen-state.py, privacy-gates it, and puts the JSON in Cloudflare KV key "qwen/data.json"
# (1-hour TTL), which the public /qwen/data.json route serves (Worker binding FLEET_KV). Long name: qwen-state-to-kv.
# Runs every 10 minutes from launchd (bin/com.justin.qwen-kv.plist). The site is never redeployed for data.
#   bin/qwen-kv.sh --dry-run   builds and gates the document, prints the write it would make; touches nothing
#   bin/qwen-kv.sh             writes to KV (a Cloudflare write; needs the token, see below)
# Code under test is never the checkout: every run fetches origin/main and exports from a git-archive snapshot of it (site#106:
#   a checkout 8 merges behind wrote no history/calls_by_day and blanked /qwen/). Fetch fails -> exit 1, nothing written.
#   The document must carry every key src/qwen-render.mjs (from that snapshot) reads as data.<key>; a missing key -> exit 1.
#   QWEN_KV_REMOTE / QWEN_KV_REF (default origin / main) point the fetch elsewhere; tests use a local repo.
# Gates, in order: snapshot -> qwen-state.py ok -> required keys present -> bin/qwen-leakcheck.py clean (any hit exits 1, nothing written, value never echoed)
#   -> sha256 differs from the last put -> PUT. as_of is part of the document, so a real run differs each time.
# Env (tests/overrides): QWEN_KV_DATA (read this file instead of running qwen-state.py), QWEN_KV_STATE (state dir, default
#   ~/.local/state/qwen-kv), QWEN_KV_NPX (the npx that runs wrangler; tests point it at a stub), plus qwen-state.py's own QWEN_* sources. Credentials as bin/fleet-kv.sh: CLOUDFLARE_API_TOKEN +
#   FLEET_KV_NAMESPACE_ID from env, else $FLEET_KV_DIR (default ~/.config/justingriffiths-site) fleet-kv.token (mode 0600)
#   and fleet-kv.namespace-id. Never printed.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/qwen-kv.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; KEY="qwen%2Fdata.json"; TTL=3600
STATE="${QWEN_KV_STATE:-$HOME/.local/state/qwen-kv}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
umask 077; mkdir -p "$STATE"
CFG="${FLEET_KV_DIR:-$HOME/.config/justingriffiths-site}"
TMP=$(mktemp); ERR=$(mktemp); SNAP=$(mktemp -d); trap 'rm -rf "$TMP" "$ERR" "$SNAP"' EXIT
ARGS="$*"
fin() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; echo "$2"; exit "$rc"; }
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

git fetch -q "${QWEN_KV_REMOTE:-origin}" "${QWEN_KV_REF:-main}" 2> "$ERR" || fin 1 "fetch failed, refusing to export from a stale checkout: $(tr '\n' ' ' < "$ERR" | cut -c1-160)"
git archive FETCH_HEAD | tar -x -C "$SNAP" || fin 1 "cannot snapshot ${QWEN_KV_REF:-main}"
[ -f "$SNAP/src/qwen-render.mjs" ] && [ -f "$SNAP/bin/qwen-state.py" ] && [ -f "$SNAP/bin/qwen-leakcheck.py" ] || fin 1 "snapshot lacks the exporter, leakcheck or renderer"
if [ -n "${QWEN_KV_DATA:-}" ]; then cp "$QWEN_KV_DATA" "$TMP" || fin 1 "cannot read QWEN_KV_DATA"
else python3 "$SNAP/bin/qwen-state.py" > "$TMP" 2> "$ERR" || fin 1 "qwen-state.py failed: $(tr '\n' ' ' < "$ERR" | cut -c1-160)"; fi
jq -e 'type=="object"' "$TMP" >/dev/null 2>&1 || fin 1 "document is not a JSON object"
# Required keys come from the renderer itself: every data.<key> it reads, plus as_of (renderFresh). "json" is a filename in a comment.
KEYS=$({ grep -o '\bdata\.[a-z_]*' "$SNAP/src/qwen-render.mjs" | sed 's/^data\.//'; echo as_of; } | grep -vx json | sort -u)
[ "$(echo "$KEYS" | wc -l | tr -d ' ')" -ge 5 ] || fin 1 "could not derive the renderer's keys"
miss=$(echo "$KEYS" | while read -r k; do jq -e --arg k "$k" 'has($k)' "$TMP" >/dev/null || printf '%s ' "$k"; done)
[ -z "$miss" ] || fin 1 "document lacks keys the renderer reads: $miss; nothing written"
SUM=$(shasum -a 256 "$TMP" | cut -d' ' -f1); BYTES=$(wc -c < "$TMP" | tr -d ' ')

why=$(python3 "$SNAP/bin/qwen-leakcheck.py" < "$TMP" 2>&1) || fin 1 "PRIVACY GATE BLOCKED (${SUM:0:12}): $why"
[ "$SUM" = "$(cat "$STATE/last-put.sha256" 2>/dev/null)" ] && fin 0 "unchanged (${SUM:0:12}); nothing written"
if [ "$DRY" = 1 ]; then
  echo "dry run: would PUT $BYTES bytes to KV key \"qwen/data.json\" (ttl ${TTL}s) in account $ACCT, namespace \${FLEET_KV_NAMESPACE_ID}"
  fin 0 "dry bytes=$BYTES sha=${SUM:0:12}"
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$CFG/fleet-kv.token" ]; then
  MODE=$(stat -f %Lp "$CFG/fleet-kv.token" 2>/dev/null || stat -c %a "$CFG/fleet-kv.token")
  [ "$MODE" = 600 ] || fin 1 "$CFG/fleet-kv.token must be mode 0600 (is $MODE)"
  CLOUDFLARE_API_TOKEN=$(tr -d '[:space:]' < "$CFG/fleet-kv.token")
fi
if [ -z "${FLEET_KV_NAMESPACE_ID:-}" ] && [ -f "$CFG/fleet-kv.namespace-id" ]; then
  FLEET_KV_NAMESPACE_ID=$(tr -d '[:space:]' < "$CFG/fleet-kv.namespace-id")
fi
# The namespace id is public (wrangler.jsonc FLEET_KV), so it defaults from there.
FLEET_KV_NAMESPACE_ID="${FLEET_KV_NAMESPACE_ID:-$(sed -n 's/.*"binding": *"FLEET_KV", *"id": *"\([0-9a-f]*\)".*/\1/p' wrangler.jsonc)}"
[ -n "${FLEET_KV_NAMESPACE_ID:-}" ] || fin 1 "no FLEET_KV_NAMESPACE_ID, no $CFG/fleet-kv.namespace-id, none in wrangler.jsonc"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  # No token: write with the logged-in wrangler session (OAuth, scope workers_kv write), the same login that deploys
  # the site. Justin, 2026-11-08: the token setup is one of his least favorite tasks.
  OUT=$(CLOUDFLARE_ACCOUNT_ID="$ACCT" "${QWEN_KV_NPX:-npx}" --yes wrangler kv key put "qwen/data.json" --path "$TMP" \
    --namespace-id "$FLEET_KV_NAMESPACE_ID" --ttl "$TTL" --remote 2>&1) || fin 1 "KV write via wrangler failed: $(echo "$OUT" | tail -n 2 | tr '\n' ' ' | cut -c1-200)"
  echo "$SUM" > "$STATE/last-put.sha256"
  fin 0 "wrote bytes=$BYTES sha=${SUM:0:12} ttl=${TTL}s via wrangler"
fi
OUT=$(curl -s -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data-binary @"$TMP" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$FLEET_KV_NAMESPACE_ID/values/$KEY?expiration_ttl=$TTL")
[ "$(echo "$OUT" | jq -r .success 2>/dev/null)" = "true" ] || fin 1 "KV write failed: $(echo "$OUT" | jq -c .errors 2>/dev/null | cut -c1-200)"
echo "$SUM" > "$STATE/last-put.sha256"
fin 0 "wrote bytes=$BYTES sha=${SUM:0:12} ttl=${TTL}s"
