# justingriffiths-site

The one-page hub at **justingriffiths.com**. A Cloudflare Worker serves it from static assets.

`bio.json` is the single source for my name, headline, bios, work, links and credits. The page is rendered from it, and the profile sync (GitHub, Slack, plus a LinkedIn checklist) will read from it too. To change any of that text, edit `bio.json`. Nowhere else.

## Layout

| Path | What |
|---|---|
| `bio.json` | Canonical text: headline, `bio.short` / `medium` / `long`, work, links (incl. Blossom tutoring), people |
| `build.mjs` | Renders `dist/index.html` from `bio.json`, no dependencies. Fails the build on an unknown block type or a `from` path that does not resolve |
| `src/shallan.css` | **Shallan**, Justin's own design system (site#60): a fork of the Pedal DS night lane with its own `:root`, corners a step smaller, serif sentences (one-line revert). Every personal page reads it. Docs: `docs/shallan.md`; Claude Design cards: `design/shallan/` |
| `src/tokens.css` | The Pedal DS token layer, for `/pedal-design/` only: DS colors, type and spacing copied from pearmill/pedal origin/main, then the `--site-*` aliases set to DS defaults |
| `src/chrome.mjs`, `src/chrome.css` | The shared header every page uses: nav (Home, Lab: Qwen/Fleet/Flows, Pedal Design, Marketing 101, Archive) and the Book a call button, plus base styles and buttons. `build.mjs` ships `shallan.css` + `chrome.css` as `/site.css`, and `tokens.css` + `chrome.css` as `/pedal-design/site.css` |
| `src/style.css`, `src/pedal-design.css` | The hub's rules (`/style.css`) and the `/pedal-design/` skin. Tokens only: no hex, no font names |
| `public/` | favicon, robots.txt, copied into `dist/` |
| `content/marketing-101/` | The Marketing 101 lesson at `/marketing-101/`: `src/` (Claude Doc export), `rewrite/` (ChatGPT's second-person copy, what ships), `diagrams/` (JSX + rendered SVG), `page.css` (Pedal night lane). Built by `build-marketing.mjs`. Re-render diagrams with `bin/render-diagrams.mjs`; check a rewrite with `bin/fidelity.py` |
| `fleet/` | (also `fleet/battle-school/`, the `/fleet/battle-school/` page: `PAGE=battle-school bin/fleet-build.sh`) The `/fleet/` scene (Rune, Rust, WebGPU): battle school and the Bike Factory from one fleet-state JSON. `bin/fleet-state.sh` exports live state to `~/.local/state/fleet-scene/state.json` (never committed; `fleet/fixture.json` is the masked copy); `bin/fleet-build.sh` builds `dist/fleet/`, `--snap` writes `docs/fleet-n1.png` headlessly. Page map draft: `docs/fleet-page-map.md` |
| `archive/` | Static snapshot of justingriffiths.info (186 pages, scripts stripped, `noindex`). `build-archive.mjs` renders the `/archive/` landing (the nav's Archive link) on the site chrome; the snapshot pages are unchanged. Re-take with `node bin/archive-snap.mjs --list` / `node bin/archive-snap.mjs <paths>`; `build.mjs` copies it to `dist/archive/` |
| `src/worker.js` | Serves the hub, 301s `www` to the apex, forwards `/learn/...` to the `blossom` Worker (Blossom Tutoring courses, repo `blossom-tutoring-lessons`) over a service binding, serves `/archive/*` (noindex), and 301s every other path to the same path under `/archive/` |

People are listed by name and work only, with no "why" lines (decided 2026-10-28).

## The page: a dossier driven by `bio.json`

The page is a cover sheet (portrait, name, headline, field rows), an index, then numbered sections. Section numbers, the index and exhibit letters (A, B, C...) are all generated from order, so adding or reordering is a JSON edit only.

The canonical text stays in the top-level keys (`name`, `location`, `headline`, `bio`, `work`, `links`, `people`), because the profile sync reads them too. `bio.dossier` only says what goes where, and points at that text with `from`, a dotted path into `bio.json` (`"bio.long"`, `"links.0"`).

```jsonc
"dossier": {
  "cover": {
    "portrait": { /* one exhibit, see below */ },
    "lede": "headline",                       // path to the line under the name
    "facts": [ { "label": "Location", "from": "location" } ]
  },
  "sections": [
    { "id": "work", "title": "Work", "blocks": [ { "type": "entries", "from": "work" } ] }
  ]
}
```

A section is `{ id, title, blocks }`. `id` is the anchor (`#work`). Each block has a `type`, and takes its list either from `from` or inline as `items`:

| `type` | Renders | Item fields |
|---|---|---|
| `prose` | Paragraphs at a ~65ch measure | `from` a string or list of strings, or `text` |
| `facts` | Field-label / value rows | `label` plus `value`/`url`, or `label` plus `from`. A `from` that resolves to an object shows `value` (or `role, name`) linked to its `url`; a list shows one line each |
| `entries` | Ruled list of names | `name`, `url`, `role`, `work` (italic), `summary` |
| `groups` | Labelled sub-lists of entries | `group`, `entries` |
| `exhibits` | Captioned media, lettered Exhibit A, B... | see below |
| `logos` | A grayscale logo strip | `name`, `url`, `src`, `placeholder` |

An exhibit is `{ type, src, alt, caption, credit, credit_url, aspect, placeholder, color }`:

- `type`: `image`, `video` (add `poster`), `audio`, or `embed` (an iframe, e.g. a YouTube or Loom embed URL).
- Images render black and white by CSS filter. Set `"color": true` to keep color.
- `aspect` overrides the frame ratio (`"4 / 5"` for photos, `"16 / 9"` for video and embeds by default).
- `"placeholder": true`, or no `src`, renders a marked "Placeholder · pending approval" box. Logos do not: a placeholder logo is not rendered at all, and a strip with no real logo renders nothing.

The hero's visual card reads `dossier.cover.visual` (`{ "src", "alt", "caption" }`). Until it is set, the card shows a drawn JG mark labelled as an illustration slot.

Media served from this site needs one Worker change first: `src/worker.js` only serves the paths in `HUB_PATHS` and 301s everything else to justingriffiths.info, so a local file such as `/media/portrait.jpg` would redirect. Until that changes, use absolute `https://` URLs or keep placeholders. Photo and logo candidates sit in `candidates/` (gitignored, with `SOURCES.txt`) until approved.

## Develop

```sh
node build.mjs            # writes dist/
npx wrangler dev          # http://localhost:8787
```

## Cutover

`wrangler.jsonc` carries the `justingriffiths.com` and `www` custom-domain routes, so **deploying it is the cutover**: it claims both domains, and from then on every non-hub path redirects to justingriffiths.info. The hub is also live on workers.dev (`justingriffiths-site.jg-personal.workers.dev`) from an earlier deploy of the no-routes config. Order:

1. **Research answers on justingriffiths.info.** The `.info` tunnel ingress already exists in the personal-web tunnel (to `web:3000`). Confirm `/research`, `/research/articles` and `/login` load on `.info`. Then retire the Vercel project and archive `justincgriffiths/justingriffiths-info`.
2. **Free the apex.** Remove the personal-web tunnel's public-hostname route for `justingriffiths.com`, and the proxied CNAME for the apex (and `www`) in Cloudflare DNS. A custom domain will not attach over an existing CNAME.
3. **Deploy.** `bin/site-build.sh` (the npm build plus all four `/fleet/` pages, so a deploy never ships without them), then `CLOUDFLARE_ACCOUNT_ID=6d4a918dd966be7c05f23b2e154b3d1d npx wrangler deploy` from `main`. Mycroft runs this; it can also be triggered through the deploy webhook at hooks.mycroft.tech.
4. **Verify.**
   - `curl -sI https://justingriffiths.com/` returns 200.
   - `curl -sI https://www.justingriffiths.com/` returns a 301 to the apex.
   - `curl -sI https://justingriffiths.com/research/articles` returns a 301 to .info.

Rollback: remove the two `routes` entries and redeploy, then restore the tunnel route and CNAME.

## Gated pages (`/fleet/`)

The visualization pages (live fleet state) are served under `/fleet/` and are never public. Two layers:

- **Cloudflare Access** (`bin/access-login.sh`) puts `justingriffiths.com/fleet` and `/marketing-101` behind Google sign-in with an email allowlist. `--dry-run` prints the planned apps and changes nothing.
- **The Worker** (`src/access.js`) verifies the Access token on every `/fleet/*` request (signature, audience, issuer, expiry) and answers 404 without one, so workers.dev and a mis-set app cannot expose the pages. Unset `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` in `wrangler.jsonc` also means 404.

The allowlist lives only in the Access policy: `bin/access-allow.sh list|add|remove` (run under `op run --env-file=bin/access.env`). No emails are committed; the scripts' `.log` files are gitignored because they record emails.

Go-live, when Justin says go: `op run --env-file=bin/access.env -- bin/access-login.sh <emails>`; copy the printed `ACCESS_TEAM_DOMAIN` and the Fleet app's `ACCESS_AUD` into `wrangler.jsonc` vars; deploy. Tests: `npm test`.

### Live feed (`/fleet/state.json`)

The mini pushes fleet state to Cloudflare KV; the Worker reads it only behind the `/fleet/` gate. Nothing is public and the data is minutes old.

- **Writer** (`bin/fleet-kv.sh`) runs `bin/fleet-state.py` and PUTs the JSON to KV key `state.json` with a 30-minute expiry, so a dead mini means 404, not stale data. `bin/fleet-kv.sh --dry-run` prints the write (key, bytes) and touches nothing. Live by hand: `op run --env-file=bin/fleet-kv.env -- bin/fleet-kv.sh`; unattended it reads `~/.config/justingriffiths-site/fleet-kv.token` (mode 0600, refused otherwise) and `fleet-kv.namespace-id` (`op` needs Touch ID and fails under launchd). Log: `bin/fleet-kv.log`.
- **Schedule** (`bin/com.justin.fleet-kv.plist`) runs it every 5 minutes. It ships unloaded (`RunAtLoad` false, not in `~/Library/LaunchAgents`).
- **Reader** (`src/worker.js`) answers `/fleet/state.json` from the `FLEET_KV` binding inside the Access check. No token, no binding or no key all return 404.
- **Sweeps panel** (`sweeps` key in the state JSON): `bin/fleet-state.py` reads the declutter sweep's `~/.local/state/declutter-sweep/summary.json` (routine-library#261; `FLEET_SWEEP_FILES` takes a colon list for more hosts) and keeps only host, run time, status and four counts. `leftover_issue` and any other field are dropped, and a row whose host or time is not the plain shape is skipped. `test/fleet-sweeps.test.mjs` fails if a name, id or path gets through. Same route, same gate: no new endpoint.

Go-live (each line is a Cloudflare write, done by ◆MYCROFT_COS, not the builder):

1. Create the KV namespace `fleet-state` in JG Personal (`6d4a918d…`). Done 2026-11-07.
2. Create an API token scoped to Workers KV Storage: Edit on that account only; nothing else. Write it to `~/.config/justingriffiths-site/fleet-kv.token` (mode 0600) on the machine that runs the writer, and the namespace id to `fleet-kv.namespace-id` beside it. Never print it.
3. `wrangler.jsonc` binds `FLEET_KV` to the `fleet-state` namespace (`7683fca9…`, created 2026-11-07, site#43). Merge, then deploy (Justin or ◆MYCROFT_COS).
4. On Minnie (`justins-mac-mini`, the pusher), `bin/fleet-kv.sh` once by hand (dry run passed there 2026-11-07, 1650 bytes), confirm one key with `npx wrangler kv key get state.json --binding FLEET_KV --remote | head -c 200`, then copy `bin/com.justin.fleet-kv.plist` to `~/Library/LaunchAgents` and `launchctl bootstrap` it.

### Meta rollout (`/fleet/meta/`, Justin only)

Per-client built / verified / live / first-hour delivery / issues, from `~/.local/state/meta-rollout/<client>.json` (schema `meta-rollout-report/1`, pearmill/pedal#636). Counts and statuses only; clients show as "Client A, B, C".

- **Reader** (`bin/meta-state.py`) is thin: `shape()` is the only code that knows the schema, and copies through an allowlist (no account id, flag detail, spend, plan or CPA). `test/meta-state.test.mjs` blocks names, ids and creative text.
- **Feed**: `bin/fleet-kv.sh` also PUTs KV key `meta.json`; the Worker serves it at `/fleet/meta/state.json`. `fleet/meta-fixture.json` is baked into the page so a preview renders without KV.
- **Gate**: the Fleet Access token is checked first, then `src/worker.js` requires the token's email to be in the `META_ALLOWLIST` secret (comma-separated). Unset means nobody (404). Set it: `printf 'justin@...' | npx wrangler secret put META_ALLOWLIST` (◆MYCROFT_COS). A separate Access app for `/fleet/meta` would not work as-is: its token carries another AUD, which `src/access.js` rejects.
- **Not public**: no link from the hub, sitemap or nav; `noindex`.

## Qwen live data (`/qwen/`)

`/qwen/data.json` is live (site#78): `bin/qwen-kv.sh` puts the aggregates in KV key `qwen/data.json` (binding `FLEET_KV`, 1-hour TTL) and the Worker serves that key publicly, falling back to the built asset when the key is missing, expired or KV errors. The page inlines `src/qwen-render.mjs`, pulls `/qwen/data.json` on a 5-minute timer and re-renders the charts and "Data as of" without a deploy; the built HTML stays the no-JS fallback. The page reads stale after 1 hour.

- **Run**: `bin/qwen-kv.sh` runs `bin/qwen-state.py`, then `bin/qwen-leakcheck.py` (any hit exits 1, nothing is written, the value is never echoed), then skips the put if the sha256 matches the last one (`~/.local/state/qwen-kv/last-put.sha256`), then PUTs. `as_of` is in the document, so a real run differs each time. `--dry-run` stops before the put. Log: `bin/qwen-kv.log`.
- **Schedule**: `bin/com.justin.qwen-kv.plist` (every 10 minutes, via `hbrun.sh`) ships unloaded; load it only after the PR merges and the Worker change is deployed. Credentials are as `bin/fleet-kv.sh` (`~/.config/justingriffiths-site/fleet-kv.token`, mode 0600).
- **History (site#90)**: `qwen-state.py` also emits `history`: per day, for wrap (`~/.local/state/wrap/*.json`, day = file modified day, no model or cost logged), PR sweeps (`pr-sweep/runs.jsonl`, with `cost_usd`) and session cleanup (`session-finish` and `declutter-sweep` logs, scripts, no cost logged). Counts, dates and dollars only; a day with no record is absent. `/qwen/` draws each as runs per day by model, a "Qwen live" marker, and a 7-day savings line ("cost not logged" where no dollars exist). Shots from real data: `docs/site-90/`.
- **No data deploys**: `bin/qwen-refresh.sh` no longer runs `wrangler deploy`; it is a build check (snapshot, privacy gate, build). Its plist is deleted. If `com.justin.qwen-refresh` is loaded on the Air, unload it.
