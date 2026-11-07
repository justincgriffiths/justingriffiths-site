// Snapshots pages of justingriffiths.info into archive/ as static HTML (issue #20).
//   node bin/archive-snap.mjs /research/articles/<slug> [more paths...]
//   node bin/archive-snap.mjs --list      # paths from the live sitemap, plus nav pages
// Each page lands at archive/<path>/index.html, served at /archive/<path>/. Scripts are stripped
// (the content is server-rendered; hydration would refetch from .info), root-relative links and
// assets are re-rooted under /archive/, and noindex is added. Content is not reorganized.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC = "https://justingriffiths.info";
const OUT = new URL("../archive/", import.meta.url).pathname;
const NAV = ["/research", "/research/articles", "/research/briefings", "/research/diversity-business",
  "/research/epstein-govt-docs", "/research/iran-conflict", "/research/microloans-ubi",
  "/research/self-hosting", "/research/sustainability-economics"];

const save = (rel, data) => { const f = join(OUT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, data); };
const get = async (p) => { const r = await fetch(SRC + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r; };
const reroot = (s) => s.replace(/(href|src|action)="\/(?!\/|archive\/|favicon)/g, '$1="/archive/');

const seen = new Set();
async function asset(p) {                       // p like /_next/static/chunks/x.css
  p = p.split("?")[0];
  if (seen.has(p)) return; seen.add(p);
  const r = await get(p);
  if (p.endsWith(".css")) {
    let css = await r.text();
    for (const m of css.matchAll(/url\(\.\.\/media\/([^)'"]+)\)/g)) await asset(`/_next/static/media/${m[1]}`);
    save(p, css);
  } else save(p, Buffer.from(await r.arrayBuffer()));
}

async function page(path) {
  let html = await (await get(path)).text();
  for (const m of html.matchAll(/href="(\/_next\/[^"]+\.css)"/g)) await asset(m[1]);
  html = html
    .replace(/<script\b[\s\S]*?<\/script>/g, "")
    .replace(/<link[^>]+rel="preload"[^>]*>/g, "")
    .replace(/<meta name="robots"[^>]*>/g, "")
    .replace("<head>", '<head><meta name="robots" content="noindex, nofollow">')
    .replace(/href="\/favicon\.ico[^"]*"/g, 'href="/favicon.svg"');
  save(join(path, "index.html"), reroot(html));
  console.log("ok", path);
}

let paths = process.argv.slice(2);
if (paths[0] === "--list") {
  const xml = await (await get("/sitemap.xml")).text();
  const fromMap = [...xml.matchAll(/<loc>https:\/\/justingriffiths\.info([^<]*)<\/loc>/g)].map((m) => m[1]);
  console.log([...new Set([...NAV, ...fromMap])].join("\n"));
} else for (const p of paths) await page(p);
