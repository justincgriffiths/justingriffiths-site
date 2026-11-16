# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Justin Griffiths, operating his own systems. He opens the site to see what his homelab, agent fleet and local models are doing, decide what needs him, and get back to work. He reads it on a laptop and on his phone (PocketPal / fleet-chat is his phone path to the fleet).

Secondary: people sizing Justin up (clients, partners, collaborators) who land on the public hub at `/`. The site is mostly private operations now; the public hub is the front door, not the main room (Justin, 2026-11-16).

## Product Purpose

justingriffiths.com is Justin's personal control panel with a public front door. Private pages, behind Google sign-in (Cloudflare Access), show the state of the things he runs: the homelab and its backups, the agent fleet, the local Qwen models, and how work flows between them. Success: he can answer "is it working, and what needs me?" from one page per system, without SSH or reading config files.

Origin of the "is it working" bar: on 2026-11-16 the NAS → Backblaze backup had run nightly since April, but a status script read its config file and reported it as protecting nothing. Two days of alarm came from a page that showed config, not outcomes.

## Positioning

A single operator's own instrument panel, written in his voice and design system, showing facts about systems he built. It is not a product for others to sign up to.

## Operating Context

- Repo `justincgriffiths/justingriffiths-site`; a Cloudflare Worker (`src/worker.js`) serves static builds from `dist/`. Account JG Personal. Justin deploys (`bin/site-build.sh`, then `wrangler deploy` from `main`); agents open PRs and do not deploy.
- Private sections are gated by Cloudflare Access with Google sign-in; the allow list lives only in the Access policy (`bin/access-allow.sh`).
- Live data reaches pages from local exporters on Justin's machines pushed to Workers KV (`bin/fleet-kv.sh`, `bin/qwen-kv.sh`); fixtures are masked copies committed for builds.
- Sections today: `/` hub (bio dossier from `bio.json`), `/qwen/` and `/qwen/dashboard/` (Tabler), `/fleet/` scene, `/fleet/battle-school/`, `/fleet/flows/`, `/marketing-101/` (lesson, private), `/pedal-design/`, `/archive/`, `/learn/` (Blossom Worker).

## Capabilities and Constraints

- Structure: **Tabler** (https://github.com/tabler/tabler) is the page shell and component base for the whole site (Justin, 2026-11-16). Already used once at `/qwen/dashboard/` (site#122).
- Design system: **Shallan** (`src/shallan.css`, `docs/shallan.md`, site#60) is Justin's own DS and the only token source for personal pages. Pedal's tokens (`src/tokens.css`) stay on `/pedal-design/` only.
- Fleet pages (`/fleet/`, `/fleet/battle-school/`, `/fleet/flows/`) are not deleted; they are to be reimagined into a better, more durable structure (Justin, 2026-11-16). How is undecided.
- First new page: `/homelab`, private, showing how data flows from each device to the NAS and on to Backblaze B2, with when and what.
- Page stylesheets use tokens only, no hex or font names (enforced by tests).
- `bio.json` is the single source for public bio text; edit it nowhere else.

## Brand Commitments

- Shallan is named for the Stormlight Lightweaver; Justin's agent seats carry Stormlight names too (Kaladin, Jasnah, Bean, Anansi).
- Voice: plain, direct, facts with evidence; signposted bullets; American spelling. Canonical: `~/brain/knowledge/brain-meta/rule-justin-writing-voice.md`.

## Evidence on Hand

- Live and fixture state for the fleet and Qwen (`fleet/fixture.json`, KV exporters).
- Homelab facts checked 2026-11-16 (NAS, Hyper Backup log, Synology Drive and Active Backup consoles); recorded in the /homelab work, not invented.
- No testimonials, client logos or metrics are approved for the public hub beyond `bio.json`. Do not fabricate.

## Product Principles

1. **Show outcomes, not config.** A status says what last succeeded and when; "unknown" when it can't tell, never a guessed failure.
2. **One page per system, one glance per page.** The top answers "working, and what needs me?"; detail sits below.
3. **Durable over clever.** Static builds, small exporters and tokens over bespoke scenes that rot when their data source moves.
4. **Facts with their source.** Every number carries where and when it was read.
5. **Private by default.** Operating pages sit behind Access; only the hub and archive are public.
