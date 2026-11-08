// Renders dist/archive/index.html: the landing for the justingriffiths.info snapshot under /archive/
// (bin/archive-snap.mjs). The snapshot pages themselves are copied as they are; this page is the way in,
// on the site chrome, so the nav's Archive link and the hub's Research link land somewhere (site#51).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { quietCta } from "./src/quiet-cta.mjs";
import { chromeHead, siteHeader, bookLink, NAV_SCRIPT } from "./src/chrome.mjs";

const ROOT = new URL("./archive/research/", import.meta.url);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Names for the snapshot's folders. A folder missing here still lists, under its slug in sentence case.
const NAMES = {
  articles: "Articles", briefings: "Briefings", "microloans-ubi": "Microloans and UBI", "self-hosting": "Self-hosting",
  "iran-conflict": "Iran conflict", "epstein-govt-docs": "Epstein government documents",
  "diversity-business": "Diversity in business", "sustainability-economics": "Sustainability economics",
};
const name = (slug) => NAMES[slug] ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const pages = (dir) => readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith("index.html")).length;

const collections = existsSync(ROOT)
  ? readdirSync(ROOT).filter((d) => statSync(new URL(d, ROOT)).isDirectory()).map((d) => ({ slug: d, name: name(d), n: pages(new URL(`${d}/`, ROOT)) }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
  : [];
const total = existsSync(ROOT) ? pages(ROOT) : 0;
let taken = "";
try { taken = execFileSync("git", ["log", "-1", "--format=%cs", "--", "archive/"], { encoding: "utf8" }).trim(); } catch {}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Archive · Justin Griffiths</title>
  <meta name="description" content="A static snapshot of justingriffiths.info, my research newsdesk.">
  <meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  ${chromeHead()}
  <style>${readFileSync(new URL("./content/archive/page.css", import.meta.url), "utf8")}</style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  ${siteHeader("archive")}
  <main id="main" class="wrap archive">
    <h1>Archive</h1>
    <p class="lede">A static snapshot of justingriffiths.info, my self-hosted research newsdesk. It is kept as it was${taken ? ` on <time datetime="${taken}">${taken}</time>` : ""}: ${total} pages, read-only, not indexed.</p>
    <p>${quietCta("/archive/research/", "Open the research home")}</p>
    <h2>Collections</h2>
    <ul class="collections">${collections.map((c) => `
      <li><a href="/archive/research/${esc(c.slug)}/"><span class="c-name">${esc(c.name)}</span><span class="c-n">${c.n} ${c.n === 1 ? "page" : "pages"}</span></a></li>`).join("")}
    </ul>
  </main>
  <footer class="site-footer"><div class="wrap"><p>Snapshot taken by <code>bin/archive-snap.mjs</code>; the pages are unchanged apart from stripped scripts.</p>${bookLink()}</div></footer>
  ${NAV_SCRIPT}
</body>
</html>
`;
mkdirSync(new URL("./dist/archive/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/archive/index.html", import.meta.url), html);
console.log(`built dist/archive/index.html (${collections.length} collections, ${total} pages)`);
