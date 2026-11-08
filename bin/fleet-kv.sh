#!/usr/bin/env bash
# fleet-kv.sh — runs the fleet-state exporter and writes its JSON to the Cloudflare KV key the
# /fleet/state.json route reads (Worker binding FLEET_KV, key "state.json"). Long name: fleet-state-to-kv.
#   op run --env-file=bin/fleet-kv.env -- bin/fleet-kv.sh            writes to KV (a Cloudflare write: Justin's go)
#   bin/fleet-kv.sh --dry-run                                         prints the write it would make; touches nothing
# FLEET_STATE_JSON=<file> reads a saved state document instead of running bin/fleet-state.py (tests; implies dry run).
# Needs CLOUDFLARE_API_TOKEN (Workers KV Storage: edit) and FLEET_KV_NAMESPACE_ID. Prints neither.
# Unattended (launchd, no Touch ID): unset values are read from $FLEET_KV_DIR (default ~/.config/justingriffiths-site):
#   fleet-kv.token (mode 0600, refused otherwise) and fleet-kv.namespace-id. Env wins over the files.
# The value expires after TTL seconds, so a dead mini means /fleet/state.json goes 404, not stale forever.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/fleet-kv.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; KEY="state.json"; TTL=1800
umask 077
CFG="${FLEET_KV_DIR:-$HOME/.config/justingriffiths-site}"
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
ARGS="$*"
fin() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; [ "$rc" = 0 ] || echo "$2" >&2; exit "$rc"; }
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
[ -n "${FLEET_STATE_JSON:-}" ] && DRY=1

if [ -n "${FLEET_STATE_JSON:-}" ]; then cp "$FLEET_STATE_JSON" "$TMP"; else python3 bin/fleet-state.py > "$TMP" 2>/dev/null || fin 1 "exporter failed"; fi
jq -e 'type=="object"' "$TMP" >/dev/null 2>&1 || fin 1 "exporter output is not a JSON object"
BYTES=$(wc -c < "$TMP" | tr -d ' ')

if [ "$DRY" = 1 ]; then
  echo "dry run: would PUT $BYTES bytes to KV key \"$KEY\" (ttl ${TTL}s) in account $ACCT, namespace \${FLEET_KV_NAMESPACE_ID}"
  fin 0 "dry bytes=$BYTES"
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
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$FLEET_KV_NAMESPACE_ID/values/$KEY?expiration_ttl=$TTL")
[ "$(echo "$OUT" | jq -r .success 2>/dev/null)" = "true" ] || fin 1 "KV write failed: $(echo "$OUT" | jq -c .errors 2>/dev/null | cut -c1-200)"
echo "wrote $BYTES bytes to KV key \"$KEY\""
fin 0 "wrote bytes=$BYTES"
