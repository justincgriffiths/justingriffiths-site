#!/usr/bin/env bash
# fleet-reader-key.sh — write the read-only fleet_reader password to ~/.config/justingriffiths-site/fleet-reader.password
# (mode 0600) for the unattended /qwen/ feed (site#126, Justin 2026-11-14 "Store password file"). Long name:
# store-the-fleet-reader-password-for-qwen-kv. Reads the op:// reference in bin/skill-cost.env; the value goes from
# `op run` straight into the file and is never printed. One Touch ID. Usage: bin/fleet-reader-key.sh
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/fleet-reader-key.log"; CFG="${FLEET_KV_DIR:-$HOME/.config/justingriffiths-site}"
umask 077; mkdir -p "$CFG"
op run --account my.1password.com --env-file=bin/skill-cost.env -- sh -c 'printf %s "$PGPASSWORD" > "$1"' _ "$CFG/fleet-reader.password"
rc=$?
[ "$rc" = 0 ] && chmod 600 "$CFG/fleet-reader.password" && [ -s "$CFG/fleet-reader.password" ] || rc=1
printf '[%s] argv=[%s] exit=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" "$rc" >> "$LOG"
exit $rc
