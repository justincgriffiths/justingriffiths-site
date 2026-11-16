// Renders the family cookbook from a checkout of the private recipes repo (justincgriffiths/recipes):
// an index page and one page per recipe. This repo is public, so recipe text never lands here or in
// dist/: the pages go to an output folder, and bin/cookbook-kv.sh uploads them to KV, where the Worker
// serves them at /cookbook/ behind the Cookbook Access app. No dependencies.
//   node build-cookbook.mjs <recipes-dir> <out-dir>     writes <out-dir>/index.html and <out-dir>/<slug>/index.html
// Recipe format: the recipes repo's AGENTS.md (YAML front matter, then Ingredients, Mise en place, Steps,
// optional Serving and Notes). The original text in sources/ shows under each recipe, folded.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromeHead, siteHeader, NAV_SCRIPT } from "./src/chrome.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

// Course order and headings on the index. A course not listed here still renders, after these.
export const COURSES = [["appetizer", "Appetizers"], ["soup", "Soups"], ["main", "Mains"], ["side", "Sides"], ["dressing", "Dressings"], ["drink", "Drinks"], ["pantry", "Pantry"]];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The front matter is flat YAML with one nested map (source). Enough of YAML for that: scalars, quoted
// strings, [a, b] lists, null/true/false/numbers, and one level of indented keys.
const scalar = (v) => {
  v = v.trim();
  if (v === "" || v === "null" || v === "~") return null;
  if (v === "true" || v === "false") return v === "true";
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^".*"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"');
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map((x) => scalar(x)).filter((x) => x !== null);
  return v;
};
export function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("no front matter");
  const meta = {};
  let parent = null;
  for (const line of m[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = line.match(/^(\s*)([A-Za-z_][\w-]*):\s?(.*)$/);
    if (!kv) throw new Error(`front matter: cannot read "${line}"`);
    const [, indent, key, value] = kv;
    if (indent && parent) { meta[parent][key] = scalar(value); continue; }
    if (value.trim() === "") { meta[key] = {}; parent = key; continue; }
    meta[key] = scalar(value); parent = null;
  }
  return { meta, body: m[2] };
}

// Body: H2 sections; inside, ### subheads, "- " bullets, "1. " numbered steps and plain paragraphs.
export function sections(body) {
  const out = [];
  for (const line of body.replace(/\r/g, "").split("\n")) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) { out.push({ name: h2[1].trim(), lines: [] }); continue; }
    if (out.length) out.at(-1).lines.push(line);
  }
  return out;
}
export function blocks(lines) {
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^### (.+)$/))) { close(); html += `<h3>${inline(m[1])}</h3>`; continue; }
    if ((m = line.match(/^\s*[-*] (.+)$/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\s*\d+\. (.+)$/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; continue; }
    close(); html += `<p>${inline(line.trim())}</p>`;
  }
  close();
  return html;
}

export function loadRecipes(dir) {
  const files = readdirSync(join(dir, "recipes")).filter((f) => f.endsWith(".md")).sort();
  return files.map((f) => {
    const { meta, body } = frontMatter(readFileSync(join(dir, "recipes", f), "utf8"));
    if (!meta.title || !SLUG.test(String(meta.slug)) || `${meta.slug}.md` !== f) throw new Error(`${f}: needs a title and a slug that matches the filename`);
    const raw = meta.source?.raw && existsSync(join(dir, meta.source.raw)) ? readFileSync(join(dir, meta.source.raw), "utf8").trim() : null;
    return { meta, sections: sections(body), original: raw };
  });
}

const fromLine = (m) => [m.attribution && `From ${m.attribution}`, m.adapted_from && `adapted from ${m.adapted_from}`].filter(Boolean).join(", ");
const courseName = (c) => (COURSES.find(([k]) => k === c) || [c, c ? c[0].toUpperCase() + c.slice(1) : "Other"])[1];
const facts = (m) => [
  m.servings != null && ["Serves", m.servings],
  m.oven_temp_f != null && ["Oven", `${m.oven_temp_f} °F`],
  m.freezes === true && ["Freezes", "Yes"],
  m.make_ahead && ["Make ahead", m.make_ahead === true ? "Yes" : m.make_ahead],
].filter(Boolean);

const page = ({ title, description, body }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${chromeHead()}
<style>${readFileSync(new URL("./content/cookbook/page.css", import.meta.url), "utf8")}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
${siteHeader("cookbook")}
<main id="main" class="center stack cookbook">
${body}
</main>
${NAV_SCRIPT}
</body></html>
`;

export function renderRecipe(r) {
  const m = r.meta, from = fromLine(m), f = facts(m);
  const body = r.sections.map((s) => {
    const id = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `<section class="part part-${id}" aria-labelledby="${id}"><h2 id="${id}">${esc(s.name)}</h2>${blocks(s.lines)}</section>`;
  }).join("\n");
  return page({
    title: `${m.title} · Family Cookbook`,
    description: `${m.title}${from ? `, ${from}` : ""}.`,
    body: `<p class="crumb"><a href="/cookbook/">Family Cookbook</a> · ${esc(courseName(m.course))}</p>
<h1>${esc(m.title)}</h1>${from ? `
<p class="from">${esc(from)}</p>` : ""}${f.length ? `
<dl class="facts">${f.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}${m.status === "incomplete" ? `
<p class="flag">This recipe is missing steps. See the notes.</p>` : ""}
${body}${r.original ? `
<details class="original"><summary>The original, as written</summary><pre>${esc(r.original)}</pre></details>` : ""}
<p class="back no-print"><a href="/cookbook/">All recipes</a> · <button type="button" onclick="print()">Print</button></p>`,
  });
}

export function renderIndex(recipes) {
  const known = COURSES.map(([k]) => k);
  const order = [...known, ...[...new Set(recipes.map((r) => r.meta.course))].filter((c) => !known.includes(c)).sort()];
  const groups = order.map((c) => [c, recipes.filter((r) => r.meta.course === c).sort((a, b) => a.meta.title.localeCompare(b.meta.title))]).filter(([, rs]) => rs.length);
  const card = (r) => {
    const m = r.meta, words = [m.title, m.attribution, ...(m.tags || [])].filter(Boolean).join(" ").toLowerCase();
    return `<li data-words="${esc(words)}"><a href="/cookbook/${m.slug}/">${esc(m.title)}</a>${m.attribution ? `<span class="who">${esc(m.attribution)}</span>` : ""}</li>`;
  };
  const cooks = [...new Set(recipes.map((r) => r.meta.attribution).filter(Boolean))].sort();
  return page({
    title: "Family Cookbook",
    description: `The family's recipes, ${recipes.length} so far.`,
    body: `<h1>Family Cookbook</h1>
<p class="lede">${recipes.length} family recipes, from ${esc(cooks.join(", ").replace(/, ([^,]*)$/, " and $1"))}. Each one opens with what to set out before you start, and ends with the original as it was written.</p>
<p class="find no-print"><label for="q">Find a recipe</label><input id="q" type="search" placeholder="brisket, Aunt Joan, beans…" autocomplete="off"></p>
${groups.map(([c, rs]) => `<section class="course" aria-labelledby="c-${esc(c)}"><h2 id="c-${esc(c)}">${esc(courseName(c))}</h2><ul class="recipes">${rs.map(card).join("")}</ul></section>`).join("\n")}
<p class="none" hidden>No recipe matches that.</p>
<script>(function(){var q=document.getElementById("q"),none=document.querySelector(".none");q.addEventListener("input",function(){var t=q.value.trim().toLowerCase(),any=false;document.querySelectorAll(".course").forEach(function(s){var n=0;s.querySelectorAll("li").forEach(function(li){var ok=!t||li.dataset.words.indexOf(t)>-1;li.hidden=!ok;if(ok)n++;});s.hidden=!n;if(n)any=true;});none.hidden=any;});})();</script>`,
  });
}

// Returns { "index.html": html, "<slug>/index.html": html, ... }.
export function renderCookbook(dir) {
  const recipes = loadRecipes(dir);
  if (!recipes.length) throw new Error(`${dir}: no recipes`);
  const out = { "index.html": renderIndex(recipes) };
  for (const r of recipes) out[`${r.meta.slug}/index.html`] = renderRecipe(r);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir, outDir] = process.argv.slice(2);
  if (!dir || !outDir) { console.error("usage: node build-cookbook.mjs <recipes-dir> <out-dir>"); process.exit(2); }
  const files = renderCookbook(dir);
  for (const [rel, html] of Object.entries(files)) {
    mkdirSync(join(outDir, rel, ".."), { recursive: true });
    writeFileSync(join(outDir, rel), html);
  }
  console.log(`built ${Object.keys(files).length} cookbook pages in ${outDir}`);
}
