// Renders dist/design-systems/index.html: the design-system directory on the site chrome. The systems themselves
// are the ◐SHALLAN gallery (justincgriffiths/shallan-agent), pulled into content/design-systems/ by bin/ds-sync.sh:
// one page per system rendering the same sample screen, a thumbnail each, and systems.json naming them.
// This script only wraps and copies them; to change an entry, change it in shallan-agent and re-sync.
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from "node:fs";
import { chromeHead, siteHeader, bookLink, NAV_SCRIPT } from "./src/chrome.mjs";

const SRC = new URL("./content/design-systems/", import.meta.url);
const OUT = new URL("./dist/design-systems/", import.meta.url);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const systems = JSON.parse(readFileSync(new URL("systems.json", SRC), "utf8"));
const ref = existsSync(new URL("REF", SRC)) ? readFileSync(new URL("REF", SRC), "utf8").trim() : "";
const GROUPS = [
  ["baseline", "Baseline", "The system Pedal runs on today, rendered from its canon."],
  ["reference", "Public systems", "Published design systems, each built from its own token package."],
  ["generated", "Original directions", "Three new directions, every text pair checked for contrast."],
];

const card = (s) => `
        <li class="ds-card stack">
          <a class="ds-shot" href="/design-systems/${esc(s.slug)}.html"><img src="/design-systems/thumbs/${esc(s.slug)}.jpg" alt="${esc(s.name)} rendering the sample dashboard" width="960" height="675" loading="lazy"></a>
          <h3><a href="/design-systems/${esc(s.slug)}.html">${esc(s.name)}</a></h3>
          <p>${esc(s.summary)}</p>
          <ul class="ds-traits">${s.traits.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <p class="ds-src">Source: ${esc(s.source)}</p>
        </li>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Design systems · Justin Griffiths</title>
  <meta name="description" content="${systems.length} design systems on the same sample screen, side by side.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  ${chromeHead()}
  <style>${readFileSync(new URL("page.css", SRC), "utf8")}</style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  ${siteHeader("design-systems")}
  <main id="main" class="center ds stack">
    <h1>Design systems</h1>
    <p class="lede">${systems.length} design systems, each drawing the same campaign dashboard. Open one to see it full size.</p>${GROUPS.map(([kind, title, note]) => {
      const list = systems.filter((s) => s.kind === kind);
      return list.length ? `
    <section class="stack" aria-labelledby="ds-${kind}">
      <h2 id="ds-${kind}">${title}</h2>
      <p>${note}</p>
      <ul class="grid ds-grid">${list.map(card).join("")}
      </ul>
    </section>` : "";
    }).join("")}
  </main>
  <footer class="site-footer"><div class="wrap"><p>Built by ◐Shallan${ref ? ` at <code>${esc(ref)}</code>` : ""}; synced with <code>bin/ds-sync.sh</code>.</p>${bookLink()}</div></footer>
  ${NAV_SCRIPT}
</body>
</html>
`;
mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("index.html", OUT), html);
cpSync(new URL("systems/", SRC), OUT, { recursive: true });
cpSync(new URL("thumbs/", SRC), new URL("thumbs/", OUT), { recursive: true });
console.log(`built dist/design-systems/index.html (${systems.length} systems)`);
