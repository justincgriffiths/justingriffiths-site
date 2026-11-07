# justingriffiths-site

The one-page hub at **justingriffiths.com**. A Cloudflare Worker serves it from static assets.

`bio.json` is the single source for my name, headline, bios, work, links and credits. The page is rendered from it, and the profile sync (GitHub, Slack, plus a LinkedIn checklist) will read from it too. To change any of that text, edit `bio.json`. Nowhere else.

## Layout

| Path | What |
|---|---|
| `bio.json` | Canonical text: headline, `bio.short` / `medium` / `long`, work, links (incl. Blossom tutoring), people |
| `build.mjs` | Renders `dist/index.html` from `bio.json`, no dependencies. Fails the build on an unknown block type or a `from` path that does not resolve |
| `public/` | CSS, favicon, robots.txt, copied into `dist/` |
| `content/marketing-101/` | The Marketing 101 lesson at `/marketing-101/`: `src/` (Claude Doc export), `rewrite/` (ChatGPT's second-person copy, what ships), `diagrams/` (JSX + rendered SVG), `page.css` (Pedal night lane). Built by `build-marketing.mjs`. Re-render diagrams with `bin/render-diagrams.mjs`; check a rewrite with `bin/fidelity.py` |
<<<<<<< HEAD
| `fleet/` | (also `fleet/battle-school/`, the `/fleet/battle-school/` page: `PAGE=battle-school bin/fleet-build.sh`) The `/fleet/` scene (Rune, Rust, WebGPU): battle school and the Bike Factory from one fleet-state JSON. `bin/fleet-state.sh` exports live state to `~/.local/state/fleet-scene/state.json` (never committed; `fleet/fixture.json` is the masked copy); `bin/fleet-build.sh` builds `dist/fleet/`, `--snap` writes `docs/fleet-n1.png` headlessly. Page map draft: `docs/fleet-page-map.md` |
=======
| `fleet/` | The `/fleet/` scene (Rune, Rust, WebGPU): battle school and the Bike Factory from one fleet-state JSON. `bin/fleet-state.sh` exports live state to `~/.local/state/fleet-scene/state.json` (never committed; `fleet/fixture.json` is the masked copy); `bin/fleet-build.sh` builds `dist/fleet/`, `--snap` writes `docs/fleet-n1.png` headlessly. Page map draft: `docs/fleet-page-map.md` |
>>>>>>> origin/main
| `src/worker.js` | Serves the hub, 301s `www` to the apex, forwards `/learn/...` to the `blossom` Worker (Blossom Tutoring courses, repo `blossom-tutoring-lessons`) over a service binding, and 301s every other path to the same path on justingriffiths.info |

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
- `"placeholder": true`, or no `src`, renders a marked "Placeholder · pending approval" box. Logos work the same way.

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
3. **Deploy.** `CLOUDFLARE_ACCOUNT_ID=6d4a918dd966be7c05f23b2e154b3d1d npx wrangler deploy` from `main`. Mycroft runs this; it can also be triggered through the deploy webhook at hooks.mycroft.tech.
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
