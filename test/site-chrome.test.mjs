// site#51: every page carries the same header: the site nav (Home, Lab: Qwen/Fleet/Flows, Pedal Design,
// Marketing 101, Archive) and one quiet action, About me (a text link to /#about, site#67). Every nav link must resolve through the Worker.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import worker from "../src/worker.js";
import { NAV, BOOK_URL } from "../src/chrome.mjs";

const root = new URL("..", import.meta.url);
const dist = (p) => new URL(`../dist/${p}`, import.meta.url);
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

// The pages `npm run build` writes, and the nav key each should mark as current.
const PAGES = [
  ["index.html", "home"],
  ["pedal-design/index.html", "pedal-design"],
  ["qwen/index.html", "qwen"],
  ["marketing-101/index.html", "marketing-101"],
  ["archive/index.html", "archive"],
];

test("every page stylesheet reads tokens only: no hex outside src/tokens.css and src/shallan.css (site#51 verify grep)", () => {
  const files = ["src/style.css", "src/chrome.css", "src/frame.css", "src/pedal-design.css", "content/qwen/page.css", "content/marketing-101/page.css", "content/archive/page.css"];
  for (const f of files) {
    const css = readFileSync(new URL(f, root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, f);
    assert.doesNotMatch(css, /^\s*:root\s*\{/m, `${f} declares its own :root`);
  }
  assert.doesNotMatch(readFileSync(new URL("build-qwen.mjs", root), "utf8"), /#[0-9a-fA-F]{6}\b/);
});
const header = (html) => html.slice(html.indexOf('<header class="site-header"'), html.indexOf("</header>"));
const EXPECTED = ["/", "/qwen/", "/fleet/", "/fleet/flows/", "/pedal-design/", "/marketing-101/", "/archive/"];

test("the nav is Home, Lab (Qwen, Fleet, Flows), Pedal Design, Marketing 101, Archive", () => {
  assert.deepEqual(NAV.map((n) => n.label), ["Home", "Lab", "Pedal Design", "Marketing 101", "Archive"]);
  assert.deepEqual(NAV[1].items.map((n) => n.label), ["Qwen", "Fleet", "Flows"]);
});

for (const [file, current] of PAGES) {
  test(`${file}: site header with every nav link, a quiet About me link, and the current page marked`, () => {
    const html = readFileSync(dist(file), "utf8");
    const h = header(html);
    assert.ok(h.length > 0, "no site header");
    const hrefs = [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const e of EXPECTED) assert.ok(hrefs.includes(e), `${file} header is missing ${e}`);
    assert.match(h, /<a class="quiet-cta header-cta" href="\/#about">About me<\/a>/);
    assert.doesNotMatch(h, /Book a call|btn-primary/);
    assert.doesNotMatch(html, /class="btn[ "]/, `${file} has a filled button`);
    const book = html.match(/>Book a call</g) ?? [];
    assert.ok(book.length <= 2, `${file}: Book a call appears ${book.length} times`);
    const item = NAV.flatMap((n) => [n, ...(n.items ?? [])]).find((n) => n.key === current);
    assert.match(h, new RegExp(`href="${item.href}"[^>]*aria-current="page"`), `${file} does not mark ${item.href}`);
    // Personal pages read Shallan (/site.css); /pedal-design/ reads the Pedal DS (site#60)
    const sheet = current === "pedal-design" ? "/pedal-design/site.css" : "/site.css";
    assert.match(html, new RegExp(`<link rel="stylesheet" href="${sheet.replace(/[./]/g, "\\$&")}">`));
    assert.match(html, /\.nav-toggle/); // the menu script
    assert.ok(!html.includes("mailto:"), `${file} has a mailto`);
  });
}

const assets = { fetch: async (req) => {
  let p = new URL(req.url).pathname.slice(1);
  if (p === "" || p.endsWith("/")) p += "index.html";
  // The real binding serves /x from x.html (html_handling auto-trailing-slash).
  if (!existsSync(dist(p)) && existsSync(dist(`${p}.html`))) p += ".html";
  return existsSync(dist(p)) ? new Response(readFileSync(dist(p))) : new Response("nf", { status: 404 });
} };

test("the public nav targets and /site.css answer 200 through the Worker", async () => {
  for (const path of ["/", "/site.css", "/qwen/", "/pedal-design/", "/marketing-101/", "/archive/"]) {
    const r = await worker.fetch(new Request(`https://justingriffiths.com${path}`), { ASSETS: assets });
    assert.equal(r.status, 200, path);
  }
});

test("/fleet/meta/ (gated) carries the site header too", async () => {
  const { page } = await import("../build-fleet-meta.mjs");
  const html = page(JSON.parse(readFileSync(new URL("fleet/meta-fixture.json", root), "utf8")));
  assert.match(html, /<header class="site-header"/);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{6}\b/);
});

test("/archive/ lists every snapshot collection and links each one", () => {
  const html = readFileSync(dist("archive/index.html"), "utf8");
  for (const d of ["articles", "briefings", "microloans-ubi", "self-hosting"]) assert.match(html, new RegExp(`href="/archive/research/${d}/"`));
});
