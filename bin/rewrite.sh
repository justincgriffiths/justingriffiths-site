#!/usr/bin/env bash
# rewrite.sh — sends one lesson tab (content/marketing-101/src/<n>.md) to ChatGPT via
# ~/brain/bin/gcopy.sh with the second-person brief, writes content/marketing-101/rewrite/<n>.md.
# Usage: bin/rewrite.sh 01-demand
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/rewrite.log"; N="${1:?tab slug}"; D=content/marketing-101
TMP=$(mktemp); cat "$D/brief.md" "$D/src/$N.md" > "$TMP"
~/brain/bin/gcopy.sh -g doc -b "$TMP" -o "$D/rewrite/$N.md" > /dev/null
rc=$?; rm -f "$TMP"
printf '[%s] argv=[%s] exit=%s bytes=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" "$rc" "$(wc -c < "$D/rewrite/$N.md" 2>/dev/null | tr -d ' ')" >> "$LOG"
exit $rc
