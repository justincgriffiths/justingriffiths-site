#!/usr/bin/env python3
"""meta-state.py — reads the meta-rollout state files and prints the JSON the /fleet/meta/ page renders.
THIN READER over the schema owned by pearmill/pedal#636 ("meta-rollout-report/1"): one
~/.local/state/meta-rollout/<client>.json per client with state, counts{}, totals{}, plan{} and flags[{state, detail}].
Only shape() knows that schema. The mapping to the page's columns (shape's comments) is a reading of it, not a spec.
Counts and statuses only: every field is copied through an allowlist, clients are labelled "Client A", "Client B"…
by sorted file order (never the file name or the client field), and account_id, flag detail text, spend, plan
figures and CPA never leave shape(). Env: META_ROLLOUT_DIR (default ~/.local/state/meta-rollout).
stdout: the JSON. Exit 0; stderr says what was skipped."""
import glob, json, os, sys
from datetime import datetime, timezone

DIR = os.path.expanduser(os.environ.get("META_ROLLOUT_DIR", "~/.local/state/meta-rollout"))
STATES = {"paused", "active", "mixed", "empty", "error"}
FLAGS = {"NO_DELIVERY_1H", "SPEND_OVER_PLAN", "DISAPPROVED", "ADS_WITH_ISSUES", "CPA_OVER_TARGET", "NO_BUILD", "ACCESS_ERROR"}


def num(d, k):
    v = (d or {}).get(k)
    return v if isinstance(v, int) and not isinstance(v, bool) and v >= 0 else 0


def shape(raw, i):
    state = raw.get("state") if raw.get("state") in STATES else "unknown"
    counts, totals = raw.get("counts"), raw.get("totals")
    flags = sorted({f.get("state") for f in (raw.get("flags") or []) if isinstance(f, dict) and f.get("state") in FLAGS})
    imps = num(totals, "impressions")
    broken = state in ("empty", "error", "unknown") or bool({"NO_BUILD", "ACCESS_ERROR"} & set(flags))
    ads = num(counts, "ads")
    return {
        "label": f"Client {chr(ord('A') + i)}",
        "state": state,
        "built": ads > 0 and not broken,                                                  # ads exist and the read worked
        "verified": ads > 0 and not broken and num(counts, "disapproved") == 0 and num(counts, "with_issues") == 0,
        "live": state in ("active", "mixed") and num(counts, "active") > 0,
        "first_hour": {"impressions": imps, "delivering": imps > 0 and "NO_DELIVERY_1H" not in flags},
        "issues": flags,
    }


def main():
    clients = []
    for i, path in enumerate(sorted(glob.glob(os.path.join(DIR, "*.json")))):
        try:
            clients.append(shape(json.load(open(path, encoding="utf-8")), len(clients)))
        except (OSError, ValueError, AttributeError, TypeError) as e:
            print(f"skip {os.path.basename(path)}: {e}", file=sys.stderr)
    print(json.dumps({"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "masked": True, "clients": clients}, indent=2))


if __name__ == "__main__":
    main()
