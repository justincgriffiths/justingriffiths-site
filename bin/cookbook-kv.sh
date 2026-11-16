#!/usr/bin/env bash
# cookbook-kv.sh — renders the family cookbook from the private recipes repo and writes the pages to the
# Cloudflare KV keys the Worker serves at /cookbook/ (binding FLEET_KV, keys "cookbook/index.html" and
# "cookbook/<slug>/index.html"). Long name: cookbook-to-kv. Recipe text never touches this public repo.
#   op run --env-file=bin/cookbook-access.env -- bin/cookbook-kv.sh             renders origin/main of justincgriffiths/recipes, writes KV
#   bin/cookbook-kv.sh --dry-run                                          renders and lists the keys; touches nothing
# RECIPES_DIR=<checkout> renders that folder instead of a fresh clone (to preview an unmerged branch).
# Keys under cookbook/ that the new render does not produce (a removed recipe) are deleted after the write.
# Needs CLOUDFLARE_API_TOKEN (Workers KV Storage: edit) and FLEET_KV_NAMESPACE_ID; prints neither. No TTL:
# the cookbook stays up until the next run replaces it. Run it again whenever a recipe PR merges.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/cookbook-kv.log"; ACCT="6d4a918dd966be7c05f23b2e154b3d1d"; REPO="justincgriffiths/recipes"
ARGS="$*"
umask 077
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
fin() { rc=$1; printf '[%s] argv=[%s] exit=%s msg="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$ARGS" "$rc" "$2" >> "$LOG"; [ "$rc" = 0 ] || echo "$2" >&2; exit "$rc"; }
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

SRC="${RECIPES_DIR:-}"
if [ -z "$SRC" ]; then
  gh repo clone "$REPO" "$WORK/recipes" -- -q --depth 1 > /dev/null 2>&1 || fin 1 "could not clone $REPO (gh auth?)"
  SRC="$WORK/recipes"
fi
REV=$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo "no-git")
node build-cookbook.mjs "$SRC" "$WORK/out" > /dev/null || fin 1 "render failed for $SRC"
# One JSON array of {key, value} for the bulk write, and the key list for the stale sweep.
node -e '
  const fs = require("fs"), path = require("path"), out = process.argv[1], pairs = [];
  const walk = (d) => fs.readdirSync(d).forEach((n) => { const p = path.join(d, n); fs.statSync(p).isDirectory() ? walk(p) : pairs.push({ key: "cookbook/" + path.relative(out, p), value: fs.readFileSync(p, "utf8") }); });
  walk(out);
  fs.writeFileSync(process.argv[2], JSON.stringify(pairs));
  fs.writeFileSync(process.argv[3], pairs.map((p) => p.key).sort().join("\n") + "\n");
' "$WORK/out" "$WORK/bulk.json" "$WORK/keys.txt" || fin 1 "could not build the KV payload"
N=$(wc -l < "$WORK/keys.txt" | tr -d ' ')

if [ "$DRY" = 1 ]; then
  echo "dry run: rendered $REPO@$REV, would PUT $N keys ($(wc -c < "$WORK/bulk.json" | tr -d ' ') bytes) to account $ACCT, namespace \${FLEET_KV_NAMESPACE_ID}:"
  sed 's/^/  /' "$WORK/keys.txt"
  fin 0 "dry rev=$REV keys=$N"
fi

FLEET_KV_NAMESPACE_ID="${FLEET_KV_NAMESPACE_ID:-7683fca9f60d446cb3799db66178df15}"   # public; also in wrangler.jsonc
# No API token: write through the wrangler login on this machine instead (it carries KV write).
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  W="npx -y wrangler@4"
  $W kv bulk put "$WORK/bulk.json" --namespace-id "$FLEET_KV_NAMESPACE_ID" --remote > "$WORK/w.log" 2>&1 || fin 1 "wrangler kv bulk put failed: $(tail -c 200 "$WORK/w.log")"
  echo "wrote $N cookbook pages from $REPO@$REV (wrangler)"
  OLD=$($W kv key list --namespace-id "$FLEET_KV_NAMESPACE_ID" --prefix cookbook/ --remote 2>/dev/null | jq -r '.[].name' | sort)
  STALE=$(comm -23 <(echo "$OLD" | sed '/^$/d') "$WORK/keys.txt")
  if [ -n "$STALE" ]; then
    echo "$STALE" | jq -R . | jq -s . > "$WORK/stale.json"
    $W kv bulk delete "$WORK/stale.json" --namespace-id "$FLEET_KV_NAMESPACE_ID" --remote --force > /dev/null 2>&1 \
      && echo "removed $(echo "$STALE" | wc -l | tr -d ' ') stale page(s)" || echo "stale page delete failed (pages still served)" >&2
  fi
  fin 0 "wrote rev=$REV keys=$N via=wrangler"
fi
NS="https://api.cloudflare.com/client/v4/accounts/$ACCT/storage/kv/namespaces/$FLEET_KV_NAMESPACE_ID"
cf() { curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }
OUT=$(cf -X PUT --data-binary @"$WORK/bulk.json" "$NS/bulk")
[ "$(echo "$OUT" | jq -r .success 2>/dev/null)" = "true" ] || fin 1 "KV bulk write failed: $(echo "$OUT" | jq -c .errors 2>/dev/null | cut -c1-200)"
echo "wrote $N cookbook pages from $REPO@$REV"

OLD=$(cf "$NS/keys?prefix=cookbook/&limit=1000" | jq -r '.result[]?.name' | sort)
STALE=$(comm -23 <(echo "$OLD" | sed '/^$/d') "$WORK/keys.txt")
if [ -n "$STALE" ]; then
  DEL=$(cf -X POST --data-binary "$(echo "$STALE" | jq -R . | jq -s .)" "$NS/bulk/delete")
  [ "$(echo "$DEL" | jq -r .success 2>/dev/null)" = "true" ] && echo "removed $(echo "$STALE" | wc -l | tr -d ' ') stale page(s)" || echo "stale page delete failed (pages still served): $(echo "$DEL" | jq -c .errors | cut -c1-200)" >&2
fi
fin 0 "wrote rev=$REV keys=$N"
