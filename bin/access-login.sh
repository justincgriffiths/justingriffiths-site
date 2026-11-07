#!/usr/bin/env bash
# access-login.sh — puts justingriffiths.com/marketing-101* and /fleet* (the visualization pages)
# behind Google sign-in (Cloudflare Access), allow-listed to the emails given. Creates (or reuses)
# a Google login method, then one Access app per path. Google also covers the one-time email code
# only if you add that login method in the dashboard; the allowlist is the Access policy itself.
# --dry-run prints the planned apps and policies, touches nothing, and needs no secrets:
#   bin/access-login.sh --dry-run viewer@example.com
# Run for real only when Justin says go (it changes Cloudflare). Secrets come from 1Password via op run:
#   op run --env-file=bin/access.env -- bin/access-login.sh you@example.com her@example.com
# Afterwards, manage the list with bin/access-allow.sh (no emails live in this repo).
# bin/access.env (gitignored values are op:// refs, not secrets):
#   CLOUDFLARE_API_TOKEN=op://Mycroft/cloudflare-api-token/credential   # needs Access: Apps and Policies + Organizations edit
#   GOOGLE_CLIENT_ID=op://Mycroft/marketing-paywall-oauth/username
#   GOOGLE_CLIENT_SECRET=op://Mycroft/marketing-paywall-oauth/credential
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/access-login.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; API="https://api.cloudflare.com/client/v4/accounts/$ACCT/access"
log() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; exit "$rc"; }
ARGS="$*"
DRY=0; [ "${1:-}" = "--dry-run" ] && { DRY=1; shift; }
[ $# -ge 1 ] || { echo "usage: access-login.sh [--dry-run] email [email ...]" >&2; log 2 "no emails"; }
# name|domain-with-path. Add a path here to gate it.
APPS=("Marketing 101|justingriffiths.com/marketing-101" "Fleet visualizations|justingriffiths.com/fleet")
INCLUDE=$(printf '%s\n' "$@" | jq -R '{email:{email:.}}' | jq -s .)
app_body() { # $1 name, $2 domain, $3 idp id
  jq -n --arg n "$1" --arg d "$2" --arg idp "$3" --argjson inc "$INCLUDE" '{name:$n, type:"self_hosted",
    domain:$d, session_duration:"720h", allowed_idps:[$idp],
    auto_redirect_to_identity:true, app_launcher_visible:false,
    policies:[{name:"Allow-listed people", decision:"allow", include:$inc}]}'
}
if [ "$DRY" = 1 ]; then
  echo "DRY RUN: nothing is sent to Cloudflare. Planned Access apps (idp id is a placeholder):"
  for a in "${APPS[@]}"; do app_body "${a%%|*}" "${a#*|}" "<google-idp-id>"; done
  echo "Then set ACCESS_TEAM_DOMAIN and ACCESS_AUD (printed per app after a real run) in wrangler.jsonc vars, and deploy."
  log 0 "dry run for $# email(s)"
fi
: "${CLOUDFLARE_API_TOKEN:?}" "${GOOGLE_CLIENT_ID:?}" "${GOOGLE_CLIENT_SECRET:?}"
cf() { curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }

ORG=$(cf "$API/organizations" | jq -r '.result.auth_domain // empty')
[ -n "$ORG" ] || log 1 "no Zero Trust org on JG Personal: create one in the dashboard (Zero Trust > Settings), then rerun"
echo "Google OAuth redirect URI must be: https://$ORG/cdn-cgi/access/callback"
echo "ACCESS_TEAM_DOMAIN=$ORG"

IDP=$(cf "$API/identity_providers" | jq -r '.result[] | select(.type=="google") | .id' | head -1)
if [ -z "$IDP" ]; then
  IDP=$(cf -X POST "$API/identity_providers" -d "$(jq -n --arg id "$GOOGLE_CLIENT_ID" --arg s "$GOOGLE_CLIENT_SECRET" \
    '{name:"Google", type:"google", config:{client_id:$id, client_secret:$s}}')" | jq -r '.result.id // empty')
  [ -n "$IDP" ] || log 1 "creating the Google login method failed"
fi

for a in "${APPS[@]}"; do
  NAME="${a%%|*}"; DOM="${a#*|}"; BODY=$(app_body "$NAME" "$DOM" "$IDP")
  EXIST=$(cf "$API/apps" | jq -r --arg d "$DOM" '.result[] | select(.domain==$d) | .id' | head -1)
  if [ -n "$EXIST" ]; then OUT=$(cf -X PUT "$API/apps/$EXIST" -d "$BODY"); else OUT=$(cf -X POST "$API/apps" -d "$BODY"); fi
  [ "$(echo "$OUT" | jq -r .success)" = "true" ] || log 1 "app write failed for $DOM: $(echo "$OUT" | jq -c '.errors' | cut -c1-200)"
  echo "$NAME: ACCESS_AUD=$(echo "$OUT" | jq -r '.result.aud')  (only the /fleet app's value goes in wrangler.jsonc)"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOM/")
  [ "$CODE" = "302" ] || log 1 "app saved but $DOM/ answered $CODE, not a 302 to sign-in"
  echo "Locked: $DOM/ now redirects to Google sign-in for $*"
done
log 0 "locked ${#APPS[@]} app(s) for $# email(s)"
