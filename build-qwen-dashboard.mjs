// Renders dist/qwen/dashboard/index.html and dist/qwen/dashboard/writeups/<slug>/index.html: the Tabler version of the
// Qwen page, built next to /qwen/ and leaving it alone. Data: content/qwen/data.json (bin/qwen-state.sh) and
// content/qwen/tests.json (bin/qwen-tests.py). Writeups: content/qwen/writeups/*.md, numbers filled from the data.
// Tabler is vendored (vendor/tabler, see vendor/tabler/VENDOR.md); nothing loads from a CDN.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { chromeHead, siteHeader, NAV_SCRIPT } from "./src/chrome.mjs";
import { renderDashboard, renderWriteup, parseWriteup, fill, mdToHtml } from "./src/qwen-dashboard-render.mjs";

const rel = (p) => new URL(p, import.meta.url);
const data = JSON.parse(readFileSync(rel("./content/qwen/data.json"), "utf8"));
const tests = JSON.parse(readFileSync(rel("./content/qwen/tests.json"), "utf8"));
const css = readFileSync(rel("./content/qwen/dashboard.css"), "utf8");
const BASE = "/qwen/dashboard/";

const page = (title, desc, body) => `<!doctype html>
<html lang="en" data-bs-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Justin Griffiths</title>
<meta name="description" content="${desc}">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${chromeHead()}
<link rel="stylesheet" href="${BASE}vendor/tabler.min.css">
<style>${css}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
${siteHeader("qwen")}
<main id="main">
${body}
</main>
${NAV_SCRIPT}
<script src="${BASE}vendor/tabler.min.js" defer></script>
</body></html>
`;

const dir = new URL("./content/qwen/writeups/", import.meta.url);
const writeups = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => {
  const { meta, body } = parseWriteup(readFileSync(new URL(f, dir), "utf8"));
  return { slug: f.replace(/\.md$/, ""), ...meta, html: mdToHtml(fill(body, data, tests)) };
});

const out = rel("./dist/qwen/dashboard/");
mkdirSync(new URL("vendor/", out), { recursive: true });
for (const f of ["tabler.min.css", "tabler.min.js"]) copyFileSync(rel(`./vendor/tabler/${f}`), new URL(`vendor/${f}`, out));
writeFileSync(new URL("index.html", out), page("Qwen model performance", "Latency, cost and accuracy for the models behind the Qwen rollout.", renderDashboard(data, tests, writeups)));
for (const w of writeups) {
  mkdirSync(new URL(`writeups/${w.slug}/`, out), { recursive: true });
  writeFileSync(new URL(`writeups/${w.slug}/index.html`, out), page(w.title, w.summary.replace(/"/g, "&quot;"), renderWriteup(w, w.html, data, tests)));
}
console.log(`built dist/qwen/dashboard/ (${writeups.length} writeups)`);
