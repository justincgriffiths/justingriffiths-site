# Game report (`/fleet/game/`)

The per-round report of the Qwen cost game. Behind the Fleet Access gate; the Worker checks the Access token too and answers 404 without one.

| | |
|---|---|
| Page | `build-fleet-game.mjs` → `dist/fleet/game/index.html` (`gameKit()` renders; the build and the in-page refresh run the same function) |
| Components | `disclosure()` from `src/disclosure.mjs` (one per round, plus "How scoring works"); table and chart styles from `content/qwen/page.css` |
| Feed | `GET /fleet/game/state.json` reads KV key `game/state.json` (`src/worker.js`); 404 when unset |
| Exporter | `bin/game-export.py`: reads Anansi's ledger (`GAME_STATE_DIR`, default `~/.local/state/anansi`), read-only, writes one JSON to stdout |
| Wrapper | `bin/game-kv.sh [--dry-run]`: exports and PUTs to KV; run after each round. Same token files as `bin/fleet-kv.sh` |
| Fixture | `fleet/game-fixture.json`: fake rows (`●DEMO_*`, example.com) |

**Public repo.** Real ledger rows (agents, issue links, costs, lessons) never enter git. The committed page is built from the fixture; real data reaches the browser only through KV, behind the gate.

Document shape (`game-state/1`): `generated_at`, `rules_md`, `learnings_md`, `totals` (agent → points), and `rounds` newest first, each `{round, start, end, rules, game_usd, learnings, events[]}` with events `{ts, round, rules, agent, event, points, usd, evidence, lesson}`.

Until the KV token exists, `bin/game-kv.sh` stops with "no CLOUDFLARE_API_TOKEN" and the page shows the fixture (marked as fake).
