#!/usr/bin/env bash
# site-build.sh — the one build every deploy path uses: the npm build (dist/ hub, /qwen/, /marketing-101/), then
# the four /fleet/ pages (landing, bike-factory, seats, battle-school) via bin/fleet-build.sh, then /fleet/meta/ (build-fleet-meta.mjs), then /fleet/flows/ (build-fleet-flows.mjs, from content/flows/*.mmd). Exits non-zero on the
# first failing step, or if a fleet page is missing from dist/ afterwards. Run from anywhere; builds in the repo it lives in.
# Needs the fleet toolchain on the Air (see bin/fleet-build.sh); cargo comes from ~/.cargo/bin.
# Env: FLEET_BUILD (default bin/fleet-build.sh; tests stub it).
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
FLEET_BUILD="${FLEET_BUILD:-bin/fleet-build.sh}"
npm run build --silent || { echo "site-build: npm build failed" >&2; exit 1; }
for page in "" bike-factory seats battle-school; do
  PAGE="$page" "$FLEET_BUILD" > /dev/null || { echo "site-build: fleet page '${page:-landing}' failed" >&2; exit 1; }
done
node build-fleet-meta.mjs > /dev/null || { echo "site-build: fleet meta page failed" >&2; exit 1; }
node build-fleet-flows.mjs || { echo "site-build: fleet flows pages failed" >&2; exit 1; }
for f in index.html bike-factory/index.html seats/index.html battle-school/index.html meta/index.html flows/index.html flows/card-to-merge/index.html; do
  [ -s "dist/fleet/$f" ] || { echo "site-build: dist/fleet/$f missing" >&2; exit 1; }
done
echo "site-build: dist/ with fleet pages ok"
