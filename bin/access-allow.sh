#!/usr/bin/env bash
# access-allow.sh — list / add / remove the emails allowed through the Cloudflare Access apps for
# /marketing-101 and /fleet. The Access policy is the only copy of the list: no emails live in this repo.
#   op run --env-file=bin/access.env -- bin/access-allow.sh list
#   op run --env-file=bin/access.env -- bin/access-allow.sh add you@example.com
#   op run --env-file=bin/access.env -- bin/access-allow.sh --dry-run remove her@example.com
# --dry-run reads the apps but writes nothing. ACCESS_APPS_JSON=<file> reads a saved
# `GET .../access/apps` response instead of the API (for tests; implies no writes).
# Needs only CLOUDFLARE_API_TOKEN (Access: Apps and Policies edit). Prints no secret.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/access-allow.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; API="https://api.cloudflare.com/client/v4/accounts/$ACCT/access"
DOMAINS=("justingriffiths.com/marketing-101" "justingriffiths.com/fleet")
POLICY="Allow-listed people"
ARGS="$*"
log() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; exit "$rc"; }
DRY=0; [ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
CMD="${1:-}"; shift || true
case "$CMD" in list) ;; add|remove) [ $# -ge 1 ] || log 2 "no emails" ;; *) echo "usage: access-allow.sh [--dry-run] list | add|remove email [email ...]" >&2; log 2 "bad command" ;; esac
[ -n "${ACCESS_APPS_JSON:-}" ] && DRY=1 || : "${CLOUDFLARE_API_TOKEN:?}"
cf() { curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }
APPS=$( [ -n "${ACCESS_APPS_JSON:-}" ] && cat "$ACCESS_APPS_JSON" || cf "$API/apps" )
[ "$(echo "$APPS" | jq -r '.success // true')" = "true" ] || log 1 "listing apps failed: $(echo "$APPS" | jq -c .errors | cut -c1-200)"

for DOM in "${DOMAINS[@]}"; do
  APP=$(echo "$APPS" | jq -c --arg d "$DOM" '.result[] | select(.domain==$d)' | head -1)
  [ -n "$APP" ] || { echo "$DOM: no Access app yet (run access-login.sh first)"; continue; }
  CUR=$(echo "$APP" | jq -r --arg p "$POLICY" '[.policies[] | select(.name==$p) | .include[].email.email // empty] | sort | .[]')
  case "$CMD" in
    list) echo "$DOM:"; echo "${CUR:-}" | sed '/^$/d; s/^/  /' ;;
    add|remove)
      WANT=$(printf '%s\n' "$@" | jq -R . | jq -s .)
      NEW=$(echo "$APP" | jq -c --arg p "$POLICY" --arg c "$CMD" --argjson w "$WANT" '
        .policies |= map(if .name==$p then
          .include = ((([.include[] | select(.email.email) | .email.email] as $cur
            | (if $c=="add" then ($cur + $w | unique) else ($cur - $w) end))
            | map({email:{email:.}})) + [.include[] | select(.email.email | not)])
          else . end)')
      AFTER=$(echo "$NEW" | jq -r --arg p "$POLICY" '[.policies[] | select(.name==$p) | .include[].email.email // empty] | sort | .[]')
      echo "$DOM: $(echo "$CUR" | sed '/^$/d' | wc -l | tr -d ' ') -> $(echo "$AFTER" | sed '/^$/d' | wc -l | tr -d ' ') allowed"
      [ "$CMD" = remove ] && [ -z "$AFTER" ] && { echo "refusing to leave $DOM with an empty allowlist" >&2; log 1 "would empty $DOM"; }
      [ "$DRY" = 1 ] && { echo "$AFTER" | sed '/^$/d; s/^/  /'; continue; }
      ID=$(echo "$APP" | jq -r .id)
      OUT=$(cf -X PUT "$API/apps/$ID" -d "$NEW")
      [ "$(echo "$OUT" | jq -r .success)" = "true" ] || log 1 "write failed for $DOM: $(echo "$OUT" | jq -c .errors | cut -c1-200)" ;;
  esac
done
log 0 "$CMD ok dry=$DRY"
