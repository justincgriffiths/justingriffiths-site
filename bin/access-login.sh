#!/usr/bin/env bash
# access-login.sh — puts justingriffiths.com/marketing-101* behind Google sign-in (Cloudflare Access),
# allow-listed to the emails given. Creates (or reuses) a Google login method, then the Access app.
# Run once, when Justin says go (it changes Cloudflare). Secrets come from 1Password via op run:
#   op run --env-file=bin/access.env -- bin/access-login.sh you@gmail.com her@gmail.com
# bin/access.env (gitignored values are op:// refs, not secrets):
#   CLOUDFLARE_API_TOKEN=op://Mycroft/cloudflare-api-token/credential   # needs Access: Apps and Policies + Organizations edit
#   GOOGLE_CLIENT_ID=op://Mycroft/marketing-paywall-oauth/username
#   GOOGLE_CLIENT_SECRET=op://Mycroft/marketing-paywall-oauth/credential
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/access-login.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; API="https://api.cloudflare.com/client/v4/accounts/$ACCT/access"
log() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; exit "$rc"; }
ARGS="$*"; [ $# -ge 1 ] || { echo "usage: access-login.sh email [email ...]" >&2; log 2 "no emails"; }
: "${CLOUDFLARE_API_TOKEN:?}" "${GOOGLE_CLIENT_ID:?}" "${GOOGLE_CLIENT_SECRET:?}"
cf() { curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }

ORG=$(cf "$API/organizations" | jq -r '.result.auth_domain // empty')
[ -n "$ORG" ] || log 1 "no Zero Trust org on JG Personal: create one in the dashboard (Zero Trust > Settings), then rerun"
echo "Google OAuth redirect URI must be: https://$ORG/cdn-cgi/access/callback"

IDP=$(cf "$API/identity_providers" | jq -r '.result[] | select(.type=="google") | .id' | head -1)
if [ -z "$IDP" ]; then
  IDP=$(cf -X POST "$API/identity_providers" -d "$(jq -n --arg id "$GOOGLE_CLIENT_ID" --arg s "$GOOGLE_CLIENT_SECRET" \
    '{name:"Google", type:"google", config:{client_id:$id, client_secret:$s}}')" | jq -r '.result.id // empty')
  [ -n "$IDP" ] || log 1 "creating the Google login method failed"
fi

INCLUDE=$(printf '%s\n' "$@" | jq -R '{email:{email:.}}' | jq -s .)
BODY=$(jq -n --arg idp "$IDP" --argjson inc "$INCLUDE" '{name:"Marketing 101", type:"self_hosted",
  domain:"justingriffiths.com/marketing-101", session_duration:"720h", allowed_idps:[$idp],
  auto_redirect_to_identity:true, app_launcher_visible:false,
  policies:[{name:"Allow-listed people", decision:"allow", include:$inc}]}')
EXIST=$(cf "$API/apps" | jq -r '.result[] | select(.domain=="justingriffiths.com/marketing-101") | .id' | head -1)
if [ -n "$EXIST" ]; then OUT=$(cf -X PUT "$API/apps/$EXIST" -d "$BODY"); else OUT=$(cf -X POST "$API/apps" -d "$BODY"); fi
[ "$(echo "$OUT" | jq -r .success)" = "true" ] || log 1 "app write failed: $(echo "$OUT" | jq -c '.errors' | cut -c1-200)"

CODE=$(curl -s -o /dev/null -w '%{http_code}' https://justingriffiths.com/marketing-101/)
[ "$CODE" = "302" ] || log 1 "app saved but /marketing-101/ answered $CODE, not a 302 to sign-in"
echo "Locked: /marketing-101/ now redirects to Google sign-in for $*"
log 0 "locked for $# email(s)"
