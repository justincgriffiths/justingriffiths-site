#!/usr/bin/env bash
# ds-sync.sh — design-system directory sync: pulls the ◐SHALLAN gallery into content/design-systems/.
# Builds the gallery from justincgriffiths/shallan-agent at SHALLAN_REF (default origin/main), never from a
# working tree, then renders one thumbnail per system with headless Chrome. build-design-systems.mjs wraps it
# in the site chrome at /design-systems/. Re-run after a gallery change; commit what it writes.
#   bin/ds-sync.sh                    SHALLAN_REPO=~/agents/shallan SHALLAN_REF=origin/main
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/ds-sync.log"
REPO="${SHALLAN_REPO:-$HOME/agents/shallan}"; REF="${SHALLAN_REF:-origin/main}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="content/design-systems"
run() {
  local tmp; tmp="$(mktemp -d)" || return 1
  git -C "$REPO" fetch -q origin || return 1
  git -C "$REPO" archive "$REF" | tar -x -C "$tmp" || return 1
  (cd "$tmp" && uv run -q shallan gallery check && uv run -q shallan gallery build "$tmp/dist") || return 1
  [ -f "$tmp/dist/systems.json" ] || { echo "no systems.json at $REF (needs shallan-agent#6)"; return 1; }
  rm -rf "$OUT/systems" "$OUT/thumbs"; mkdir -p "$OUT/systems" "$OUT/thumbs"
  rm -f "$tmp/dist/index.html"
  cp -R "$tmp/dist/." "$OUT/systems/" && mv "$OUT/systems/systems.json" "$OUT/systems.json" || return 1
  local slug
  for slug in $(python3 -c 'import json,sys;print(" ".join(s["slug"] for s in json.load(open(sys.argv[1]))))' "$OUT/systems.json"); do
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --window-size=1280,900 \
      --screenshot="$tmp/$slug.png" "file://$PWD/$OUT/systems/$slug.html" >/dev/null 2>&1 || return 1
    sips -s format jpeg -s formatOptions 80 -Z 960 "$tmp/$slug.png" --out "$OUT/thumbs/$slug.jpg" >/dev/null || return 1
  done
  git -C "$REPO" rev-parse --short "$REF" > "$OUT/REF"
  rm -rf "$tmp"
  echo "synced $(ls "$OUT/thumbs" | wc -l | tr -d ' ') systems from shallan-agent $REF ($(cat "$OUT/REF"))"
}
out="$(run 2>&1)"; rc=$?
printf '%s\n' "$out"
printf '[%s] argv=[%s] ref=%s exit=%s tail="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" "$REF" "$rc" "$(printf '%s' "$out" | tail -1)" >> "$LOG"
exit $rc
