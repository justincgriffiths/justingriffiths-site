# justingriffiths-site

The one-page hub at **justingriffiths.com**. A Cloudflare Worker serves it from static assets.

`bio.json` is the single source for my name, headline, bios, work, links and credits. The page is rendered from it, and the profile sync (GitHub, Slack, plus a LinkedIn checklist) will read from it too. To change any of that text, edit `bio.json`. Nowhere else.

## Layout

| Path | What |
|---|---|
| `bio.json` | Canonical text: headline, `bio.short` / `medium` / `long`, work, links (incl. Blossom tutoring), people |
| `build.mjs` | Renders `dist/index.html` from `bio.json`, no dependencies |
| `public/` | CSS, favicon, robots.txt, copied into `dist/` |
| `src/worker.js` | Serves the hub, 301s `www` to the apex, and 301s every other path to the same path on justingriffiths.info |

People are listed by name and work only, with no "why" lines (decided 2026-10-28).

## Develop

```sh
node build.mjs            # writes dist/
npx wrangler dev          # http://localhost:8787
```

## Cutover

Deploying claims `justingriffiths.com` and `www` as Worker custom domains, and from then on every non-hub path redirects to justingriffiths.info. So the order is:

1. **Research answers on justingriffiths.info.** Add the tunnel ingress for `justingriffiths.info` to `web:3000` in basecamp, and confirm that `/research`, `/research/articles` and `/login` load there. Then retire the Vercel project and archive `justincgriffiths/justingriffiths-info`.
2. **Free the apex.** Remove the tunnel's public-hostname route for `justingriffiths.com`, and its DNS record, in the Cloudflare dashboard.
3. **Deploy.** `npx wrangler login`, then `npx wrangler deploy`.
4. **Verify.**
   - `curl -sI https://justingriffiths.com/` returns 200.
   - `curl -sI https://www.justingriffiths.com/` returns a 301 to the apex.
   - `curl -sI https://justingriffiths.com/research/articles` returns a 301 to .info.
