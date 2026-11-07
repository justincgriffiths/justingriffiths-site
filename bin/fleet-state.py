#!/usr/bin/env python3
"""fleet-state.py — reads live fleet state and prints one JSON document for the /fleet/ scene.
Read only: `claude agents --json`, the seat bus files (~/.local/state/seat-bus/*.jsonl, latest
envelope per card) and each card's GitHub title and state over `gh api` REST. Never writes a bus.
stdin: nothing. stdout: the JSON. `--mask` replaces client names with "Client A" (for the committed
fixture); `--no-gh` skips the GitHub lookups. Exit 0 on success; stderr carries what was skipped."""
import argparse, glob, json, os, re, subprocess, sys
from datetime import datetime, timezone

SEATS = ["◆MYCROFT_COS", "●ANANSI_ROUTER", "■KALADIN", "✦BEAN", "▲BIKE_SHOP_FACTORY"]
TOONS = [("a", "read"), ("b", "write"), ("c", "analysis"), ("d", "creative"), ("e", "tracking"), ("f", "comms"), ("g", "access")]
# Armies live outside the repo (they name clients): ~/.local/state/fleet-scene/armies.json, a list of
# {"slug": "<session-name slug>", "name": "<display>"}. Masked to "Client A", "Client B"… with --mask.
STATE_DIR = os.path.expanduser("~/.local/state/fleet-scene")
BUS = os.path.expanduser("~/.local/state/seat-bus")
CARD = re.compile(r"github\.com/([\w.-]+)/([\w.-]+)/(?:issues|pull)/(\d+)")
SWEEP_DIR = os.path.expanduser("~/.local/state/declutter-sweep")
HOST = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")
STAMP = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
LANE = re.compile(r"/worktrees/([\w.-]+)/(?:lane/)?(\d+)-([\w.-]+)/?$")


def run(cmd, timeout=240):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False).stdout
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"skip {cmd[0]}: {e}", file=sys.stderr)
        return ""


def agents():
    out = run(["claude", "agents", "--json"])
    try:
        return json.JSONDecoder().raw_decode(out.lstrip())[0] if out.strip() else []
    except ValueError as e:
        print(f"skip claude agents: {e}", file=sys.stderr)
        return []


def lane_state(a):
    s = (a.get("state") or "").lower()
    if s == "working" or a.get("status") == "busy":
        return "working"
    if s == "blocked" or a.get("status") == "waiting":
        return "blocked"
    return "idle"


def envelopes(seat):
    rows = []
    for line in open(os.path.join(BUS, f"{seat}.jsonl"), encoding="utf-8") if os.path.exists(os.path.join(BUS, f"{seat}.jsonl")) else []:
        try:
            rows.append(json.loads(line))
        except ValueError:
            pass
    latest = {}
    for r in rows:  # latest per card, by timestamp
        c = r.get("card", "")
        if c and (c not in latest or r.get("ts", "") >= latest[c].get("ts", "")):
            latest[c] = r
    return sorted(latest.values(), key=lambda r: r.get("ts", ""), reverse=True)


_titles = {}


def gh_title(owner, repo, n, use_gh):
    key = (owner, repo, n)
    if key in _titles:
        return _titles[key]
    title, state = "", ""
    if use_gh:
        out = run(["gh", "api", f"repos/{owner}/{repo}/issues/{n}", "--jq", "[.title,.state]|@tsv"], timeout=30)
        if "\t" in out:
            title, state = out.strip().split("\t", 1)
    _titles[key] = (title, state)
    return _titles[key]


def card_label(url_or_path, use_gh):
    m = CARD.search(url_or_path or "")
    if not m:
        return url_or_path or ""
    owner, repo, n = m.groups()
    title, state = gh_title(owner, repo, n, use_gh)
    label = f"{repo}#{n}"
    if title:
        label += f" · {title}"
    if state == "closed":
        label += " (closed)"
    return label


def origin_repo(cwd):
    out = run(["git", "-C", cwd, "remote", "get-url", "origin"], timeout=10).strip()
    m = re.search(r"github\.com[:/]([\w.-]+)/([\w.-]+?)(?:\.git)?$", out)
    return m.groups() if m else None


def armies_map():
    path = os.environ.get("FLEET_ARMIES", os.path.join(STATE_DIR, "armies.json"))
    try:
        return [(a["slug"], a["name"]) for a in json.load(open(path, encoding="utf-8"))]
    except (OSError, ValueError, KeyError, TypeError) as e:
        print(f"no armies ({path}): {e}", file=sys.stderr)
        return []


def sweeps():
    """The declutter sweep's per-host summary (routine-library#261: summary.json), as counts and a run
    time only. An allowlist: host, run_at, status and four integers survive; leftover_issue and any other
    field (a name, id or path) never reach the page. A file that fails the shape check is skipped.
    FLEET_SWEEP_FILES (colon list) names the summaries to read; default is this host's summary.json."""
    files = [f for f in os.environ.get("FLEET_SWEEP_FILES", os.path.join(SWEEP_DIR, "summary.json")).split(":") if f]
    out = []
    for f in files:
        try:
            d = json.load(open(f, encoding="utf-8"))
            ints = {k: d[k] for k in ("removed", "tombstoned", "left", "errors")}
            ok = (d["schema"] == 1 and HOST.match(d["host"]) and STAMP.match(d["run_at"]) and d["status"] in ("ok", "error")
                  and all(type(v) is int and 0 <= v < 10**6 for v in ints.values()))
        except (OSError, ValueError, KeyError, TypeError) as e:
            print(f"skip sweep summary ({os.path.basename(f)}): {e}", file=sys.stderr)
            continue
        if not ok:
            print(f"skip sweep summary ({os.path.basename(f)}): bad shape", file=sys.stderr)
            continue
        out.append({"host": d["host"], "run_at": d["run_at"], "status": d["status"], **ints})
    return sorted(out, key=lambda r: r["host"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mask", action="store_true")
    ap.add_argument("--no-gh", action="store_true")
    args = ap.parse_args()
    use_gh = not args.no_gh
    live = agents()
    by_name = {a.get("name", ""): a for a in live}

    seats = []
    for seat in SEATS:
        a = by_name.get(seat)
        env = envelopes(seat)
        held = next((e for e in env if e.get("state") in ("new", "blocked", "working")), env[0] if env else None)
        state = lane_state(a) if a else ("blocked" if held and held.get("state") == "blocked" else "idle")
        seats.append({"name": seat, "state": state, "card": card_label(held.get("card"), use_gh) if held else "",
                      "note": (held.get("note") or "")[:120] if held else ""})

    ARMIES = armies_map()
    armies = []
    for i, (slug, display) in enumerate(ARMIES):
        toons = []
        for letter, kind in TOONS:
            a = next((v for k, v in by_name.items() if slug in k and f"-{letter}-" in k and "toon" in k), None)
            toons.append({"name": f"{letter.upper()} · {kind}", "state": lane_state(a) if a else "idle",
                          "card": "", "note": a.get("name", "") if a else ""})
        name = f"Client {chr(ord('A') + i)}" if args.mask else display
        armies.append({"name": name, "toons": toons})

    bridges = []
    for a in live:
        m = LANE.search(a.get("cwd", ""))
        if not m or "toon" in (a.get("name") or ""):
            continue
        wt, n, slug = m.groups()
        repo = origin_repo(a["cwd"]) if os.path.isdir(a["cwd"]) else None
        card = card_label(f"https://github.com/{repo[0]}/{repo[1]}/issues/{n}", use_gh) if repo else f"{wt}#{n}"
        bridges.append({"name": f"{wt} · {n}-{slug}", "state": lane_state(a), "card": card, "note": a.get("name", "")})

    doc = {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "masked": args.mask,
           "battle_school": {"armies": armies}, "bike_factory": {"seats": seats, "bridges": bridges}, "sweeps": sweeps()}
    text = json.dumps(doc, ensure_ascii=False, indent=2)
    if args.mask:
        for i, (slug, display) in enumerate(ARMIES):
            for needle in (display, slug, display.split()[0], "".join(w[0] for w in display.split())):
                text = re.sub(re.escape(needle), f"Client {chr(ord('A') + i)}", text, flags=re.I)
    print(text)


if __name__ == "__main__":
    main()
