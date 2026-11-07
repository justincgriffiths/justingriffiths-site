#!/usr/bin/env bash
# fleet-build.sh — builds the /fleet/ scene: the web target into dist/fleet/ (served under the
# Access gate from PR #10), or with --snap a headless PNG + element tree into docs/.
# Needs: rustup (fleet/rust-toolchain.toml picks 1.99.1), the wasm32-unknown-unknown target and
# wasm-bindgen-cli 0.2.129 (see fleet/Cargo.toml), python3.11+ for Rune's web-build.sh.
# FLEET_STATE=<json> renders live state (from bin/fleet-state.sh) instead of fleet/fixture.json.
# PAGE=battle-school builds the /fleet/battle-school/ page (fleet/battle-school crate) instead of the landing scene:
#   PAGE=battle-school bin/fleet-build.sh [--snap]  → dist/fleet/battle-school/ or docs/battle-school-n1.png
set -uo pipefail
cd "$(dirname "$0")/.."
PAGE="${PAGE:-}"
LOG="bin/fleet-build.log"; export PATH="$HOME/.cargo/bin:$PATH"
run() {
  if [ "${1:-}" = "--snap" ]; then
    mkdir -p docs
    if [ "$PAGE" = battle-school ]; then
      (cd fleet/battle-school && cargo run -q -- --snap ../../docs/battle-school-n1.png --size 1120x900 --scale 2) || return 1
      echo "docs/battle-school-n1.png"; return 0
    fi
    (cd fleet && cargo run -q -- --snap ../docs/fleet-n1.png --size 1120x640 --scale 2 \
      && cargo run -q -- --tree ../docs/fleet-n1.tree.json) || return 1
    echo "docs/fleet-n1.png docs/fleet-n1.tree.json"; return 0
  fi
  local pkg=fleet-scene out=../dist/fleet dir=fleet
  [ "$PAGE" = battle-school ] && { pkg=battle-school; out=../../dist/fleet/battle-school; dir=fleet/battle-school; }
  local rune; rune=$(cd fleet && cargo metadata --format-version 1 2>/dev/null \
    | python3 -c 'import json,sys,os; m=json.load(sys.stdin); print(os.path.dirname(next(p["manifest_path"] for p in m["packages"] if p["name"]=="rune")))')
  rune=$(cd "$rune/../.." && pwd)   # crates/rune → repo root of the cargo git checkout
  # Rune's web-build.sh calls python3 and needs tomllib (3.11+); macOS's python3 is 3.9, so shim it.
  local py shim; py=$(command -v python3.11 || command -v python3.12 || command -v python3.14 || command -v python3)
  shim=$(mktemp -d) && ln -s "$py" "$shim/python3"
  mkdir -p "dist/${out#*dist/}"
  (cd "$dir" && PATH="$shim:$PATH" bash "$rune/scripts/web-build.sh" "$pkg" --out "$out" "$@"); local rc=$?
  rm -rf "$shim"; [ "$rc" = 0 ] || return 1
  echo "dist/${out#*dist/}/"; return 0
}
run "$@"; rc=$?
printf '[%s] page=%s argv=[%s] exit=%s state=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${PAGE:-landing}" "$*" "$rc" "${FLEET_STATE:-fixture}" >> "$LOG"
exit $rc
