#!/usr/bin/env bash
# game-kv.sh — runs bin/game-export.py and writes its JSON to Cloudflare KV key "game/state.json", which the
# /fleet/game/state.json route reads (Worker binding FLEET_KV). Long name: game-state-to-kv. Run after each round.
#   bin/game-kv.sh --dry-run      exports, validates, prints the write it would make; touches nothing
#   bin/game-kv.sh                writes to KV (a Cloudflare write: Justin's go; needs his token, see below)
# GAME_STATE_JSON=<file> reads a saved document instead of running the exporter (tests; implies dry run).
# Credentials as bin/fleet-kv.sh: CLOUDFLARE_API_TOKEN + FLEET_KV_NAMESPACE_ID from env, else $FLEET_KV_DIR
# (default ~/.config/justingriffiths-site) fleet-kv.token (mode 0600) and fleet-kv.namespace-id. Never printed.
# The document is real ledger data: it goes to KV only, never into the repo. No TTL: the last round stays up.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/game-kv.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; KEY="game%2Fstate.json"
umask 077
CFG="${FLEET_KV_DIR:-$HOME/.config/justingriffiths-site}"
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
ARGS="$*"
fin() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; [ "$rc" = 0 ] || echo "$2" >&2; exit "$rc"; }
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
[ -n "${GAME_STATE_JSON:-}" ] && DRY=1

if [ -n "${GAME_STATE_JSON:-}" ]; then cp "$GAME_STATE_JSON" "$TMP"; else python3 bin/game-export.py > "$TMP" 2>/dev/null || fin 1 "exporter failed"; fi
jq -e '.schema=="game-state/1" and (.rounds|type=="array")' "$TMP" >/dev/null 2>&1 || fin 1 "exporter output is not a game-state/1 document"
BYTES=$(wc -c < "$TMP" | tr -d ' ')
ROUNDS=$(jq '.rounds|length' "$TMP"); EVENTS=$(jq '[.rounds[].events|length]|add // 0' "$TMP")

if [ "$DRY" = 1 ]; then
  echo "dry run: would PUT $BYTES bytes ($ROUNDS rounds, $EVENTS events) to KV key \"game/state.json\" in account $ACCT, namespace \${FLEET_KV_NAMESPACE_ID}"
  fin 0 "dry bytes=$BYTES rounds=$ROUNDS events=$EVENTS"
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$CFG/fleet-kv.token" ]; then
  MODE=$(stat -f %Lp "$CFG/fleet-kv.token" 2>/dev/null || stat -c %a "$CFG/fleet-kv.token")
  [ "$MODE" = 600 ] || fin 1 "$CFG/fleet-kv.token must be mode 0600 (is $MODE)"
  CLOUDFLARE_API_TOKEN=$(tr -d '[:space:]' < "$CFG/fleet-kv.token")
fi
if [ -z "${FLEET_KV_NAMESPACE_ID:-}" ] && [ -f "$CFG/fleet-kv.namespace-id" ]; then
  FLEET_KV_NAMESPACE_ID=$(tr -d '[:space:]' < "$CFG/fleet-kv.namespace-id")
fi
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || fin 1 "no CLOUDFLARE_API_TOKEN and no $CFG/fleet-kv.token"
[ -n "${FLEET_KV_NAMESPACE_ID:-}" ] || fin 1 "no FLEET_KV_NAMESPACE_ID and no $CFG/fleet-kv.namespace-id"
OUT=$(curl -s -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data-binary @"$TMP" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$FLEET_KV_NAMESPACE_ID/values/$KEY")
[ "$(echo "$OUT" | jq -r .success 2>/dev/null)" = "true" ] || fin 1 "KV write failed: $(echo "$OUT" | jq -c .errors 2>/dev/null | cut -c1-200)"
echo "wrote $BYTES bytes ($ROUNDS rounds, $EVENTS events) to KV key \"game/state.json\""
fin 0 "wrote bytes=$BYTES rounds=$ROUNDS events=$EVENTS"
