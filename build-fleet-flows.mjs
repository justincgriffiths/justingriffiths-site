// Builds the gated /fleet/flows/ pages from content/flows/*.mmd: dist/fleet/flows/index.html (the list) and
// dist/fleet/flows/<slug>/index.html (one flow drawn). Drawing happens in the page with a pinned, SRI-checked mermaid.js
// (static SVG at build time would need a headless browser). The source text is baked into the page too, so it is
// readable even if the script cannot load. A flow with a bad header or no diagram type fails the build.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";

export const MERMAID = {
  src: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
  integrity: "sha384-rbtjAdnIQE/aQJGEgXrVUlMibdfTSa4PQju4HDhN3sR2PmaKFzhEafuePsl9H/9I",
};
const DIAGRAMS = /^(flowchart|graph|sequenceDiagram|stateDiagram(-v2)?|classDiagram|erDiagram|journey|gantt|timeline|mindmap|gitGraph)\b/;
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Header: leading `%% key: value` lines for title, owner, source-of-truth-for. Throws with the file name on a miss.
export function parseFlow(slug, text) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`flows: "${slug}.mmd" must be a lowercase-hyphen slug`);
  const meta = {};
  const lines = text.split("\n");
  let i = 0;
  for (; i < lines.length && lines[i].startsWith("%%"); i++) {
    const m = lines[i].match(/^%%\s*([a-z-]+):\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  for (const k of ["title", "owner", "source-of-truth-for"]) if (!meta[k]) throw new Error(`flows: ${slug}.mmd header is missing "%% ${k}: ..."`);
  const body = lines.slice(i).join("\n").trim();
  if (!DIAGRAMS.test(body)) throw new Error(`flows: ${slug}.mmd has no diagram after the header (expected flowchart, sequenceDiagram, ...)`);
  return { slug, title: meta.title, owner: meta.owner, truth: meta["source-of-truth-for"], source: text };
}

const STYLE = `<style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:64rem;padding:0 1rem;color:#1A1A2E}
a{color:#1A1A2E}li{margin:.5rem 0}small{color:#555}.flow{overflow-x:auto}pre{background:#f6f6f8;padding:1rem;overflow-x:auto;font-size:13px}</style>`;
const head = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>${STYLE}</head><body>`;

export function listPage(flows) {
  const items = flows.map((f) => `<li><a href="/fleet/flows/${f.slug}/">${esc(f.title)}</a><br><small>Owner ${esc(f.owner)}. ${esc(f.truth)}</small></li>`).join("");
  return `${head("Fleet flows")}<h1>Fleet flows</h1><p><a href="/fleet/">Fleet</a></p>
<ul>${items || "<li>No flows yet. See content/flows/README.md.</li>"}</ul></body></html>
`;
}

export function flowPage(f) {
  return `${head(f.title)}<p><a href="/fleet/flows/">All flows</a></p><h1>${esc(f.title)}</h1>
<p><small>Owner ${esc(f.owner)}. ${esc(f.truth)} Source: content/flows/${f.slug}.mmd. Dashed boxes are inferred.</small></p>
<div class="flow"><pre class="mermaid">${esc(f.source)}</pre></div>
<script src="${MERMAID.src}" integrity="${MERMAID.integrity}" crossorigin="anonymous"></script>
<script>if(window.mermaid){mermaid.initialize({startOnLoad:true,securityLevel:"strict",theme:"neutral"});}</script>
</body></html>
`;
}

export function build(dir = new URL("./content/flows/", import.meta.url), out = "dist/fleet/flows") {
  const flows = readdirSync(dir).filter((n) => n.endsWith(".mmd")).sort()
    .map((n) => parseFlow(n.slice(0, -4), readFileSync(new URL(n, dir), "utf8")));
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/index.html`, listPage(flows));
  for (const f of flows) {
    mkdirSync(`${out}/${f.slug}`, { recursive: true });
    writeFileSync(`${out}/${f.slug}/index.html`, flowPage(f));
  }
  return flows;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of build()) console.log(`dist/fleet/flows/${f.slug}/index.html`);
}
