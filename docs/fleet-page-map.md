# /fleet/ page map (draft, for Justin to decide)

Options from the N=1 build (justingriffiths-site#8). Each row is a page the fleet suggests, the GitHub agent
repo(s) whose state would feed it, and what it would show. Justin decided the Decision column on 2026-11-07.

| Page | Feeds (repo → source) | Shows | Decision |
|---|---|---|---|
| `/fleet/` | all of the below | The N=1 scene: battle school and Bike Factory side by side, one line per lane (name, state, card). The landing page behind the gate. |**build (landing, PR #11)** |
| `/fleet/battle-school/` | **bean-agent** → `.claude/agents/toon-*.md`, `armies/<client>/pack.yaml`, bus `✦BEAN.jsonl`; **kaladin-agent** → the permanent toon lanes on the mini (#24, #26) | One army per client, its seven toons (A read … G access), each toon's state and card; which connection each toon probed and when (toon G's map). Client names masked unless signed in. |**build this weekend** |
| `/fleet/bike-factory/` | **bike-shop** → `queue/BS-*.md`, bus `▲BIKE_SHOP_FACTORY.jsonl`; **kaladin-agent** → lane runs, bridge sessions (`AGT_BLD_*`); **anansi-agent** → `maps/repos.yaml` (which repos have a lane) | Bridges by repo, which bridgeman holds which card, blocked vs working, and the queue of BS cards not yet picked up. |**build this weekend** |
| `/fleet/seats/` | all five seat buses in `~/.local/state/seat-bus/` (bike-shop#42 protocol) | The envelope flow between seats: who dispatched what to whom, latest state per card, what is waiting on Justin. |**build this weekend** |
| `/fleet/router/` | **anansi-agent** → routes (model, cap), `maps/clients.yaml` connection map, sessions map (#112, #114) | Where each card was routed, the model and cost cap it got, and which machine (laptop or mini) each seat runs on. |**not now** |
| `/fleet/cos/` | **mycroft** → triage runs, `queue/`, bus `◆MYCROFT_COS.jsonl` | What the chief of staff filed overnight, what it handed to CoS screens for Justin, and the open Review / Decide items. |**not now** |
| `/fleet/ranks/` | **kaladin-agent** → bridgemen ranks (Navani's ledger, when it exists) | Each bridgeman's rank, the cards that moved it, and who is up next. Not buildable until the ledger exists. |**not now** |
| `/fleet/cost/` | **mycroft** → #653 session pricing; **claude-harness** → #135 actor seat metrics | Spend by seat and by lane, per day; the fleet budget against the cost ladder. |**not now** |
| `/fleet/brain/` | **brain** → `canonical/agents.yaml`, `knowledge/fleet/` | The roster as the brain records it, next to the live roster, with drift flagged. |**not now** |

Live feed: the mini pushes state.json to Cloudflare KV, read only by the Worker behind Access (Justin, 2026-11-07).

## Notes from the N=1

- **Data path.** `bin/fleet-state.sh` → `~/.local/state/fleet-scene/state.json` (gitignored path) → `FLEET_STATE=… bin/fleet-build.sh`. The committed `fleet/fixture.json` is masked ("Client A"). The live feed to the page (how `state.json` reaches the Worker without going public) is the child card that follows the login (#8, "Live feed").
- **One machine's view.** `claude agents --json` lists this laptop's sessions only; the toon lanes on the mini (kaladin-agent#24) show idle until the sessions map (anansi-agent#112, bike-shop#74) is merged into the exporter.
- **States.** The scene draws three: working, blocked, idle. The exporter maps `busy`/`working` → working, `waiting`/`blocked` → blocked, everything else → idle.
