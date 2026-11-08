#!/usr/bin/env bash
# skill-cost.sh — qwen-state.py with the telemetry read on: runs it under `op run` so the read-only fleet_reader password
# (bin/skill-cost.env, an op:// reference, never a literal) reaches the process env and nothing else. Prints the data.json (site#115).
# Long name: skill-cost-qwen-state. Usage: bin/skill-cost.sh [> content/qwen/data.json]   Logs to bin/skill-cost.log.
set -uo pipefail
cd "$(dirname "$0")/.."
LOG="bin/skill-cost.log"
op run --account my.1password.com --env-file=bin/skill-cost.env -- python3 bin/qwen-state.py "$@" 2> bin/skill-cost.err; rc=$?
printf '[%s] argv=[%s] exit=%s err="%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" "$rc" "$(tr '\n' ' ' < bin/skill-cost.err | cut -c1-200)" >> "$LOG"
rm -f bin/skill-cost.err
exit "$rc"
