// site#51: every page carries the same header: the site nav (Home, Lab: Qwen/Fleet/Flows, Pedal Design,
// Marketing 101, Archive) and one primary action, Book a call. Every nav link must resolve through the Worker.
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
];
const header = (html) => html.slice(html.indexOf('<header class="site-header"'), html.indexOf("</header>"));
const EXPECTED = ["/", "/qwen/", "/fleet/", "/fleet/flows/", "/pedal-design/", "/marketing-101/", "/archive/"];

test("the nav is Home, Lab (Qwen, Fleet, Flows), Pedal Design, Marketing 101, Archive", () => {
  assert.deepEqual(NAV.map((n) => n.label), ["Home", "Lab", "Pedal Design", "Marketing 101", "Archive"]);
  assert.deepEqual(NAV[1].items.map((n) => n.label), ["Qwen", "Fleet", "Flows"]);
});

for (const [file, current] of PAGES) {
  test(`${file}: site header with every nav link, Book a call, and the current page marked`, () => {
    const html = readFileSync(dist(file), "utf8");
    const h = header(html);
    assert.ok(h.length > 0, "no site header");
    const hrefs = [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    for (const e of EXPECTED) assert.ok(hrefs.includes(e), `${file} header is missing ${e}`);
    assert.match(h, new RegExp(`class="btn btn-primary[^"]*" href="${BOOK_URL.replace(/\./g, "\\.")}"[^>]*>Book a call<`));
    const item = NAV.flatMap((n) => [n, ...(n.items ?? [])]).find((n) => n.key === current);
    assert.match(h, new RegExp(`href="${item.href}"[^>]*aria-current="page"`), `${file} does not mark ${item.href}`);
    assert.match(html, /<link rel="stylesheet" href="\/site\.css">/);
    assert.match(html, /\.nav-toggle/); // the menu script
    assert.ok(!html.includes("mailto:"), `${file} has a mailto`);
  });
}

const assets = { fetch: async (req) => {
  let p = new URL(req.url).pathname.slice(1);
  if (p === "" || p.endsWith("/")) p += "index.html";
  return existsSync(dist(p)) ? new Response(readFileSync(dist(p))) : new Response("nf", { status: 404 });
} };

test("the public nav targets and /site.css answer 200 through the Worker", async () => {
  for (const path of ["/", "/site.css", "/qwen/", "/pedal-design/", "/marketing-101/"]) {
    const r = await worker.fetch(new Request(`https://justingriffiths.com${path}`), { ASSETS: assets });
    assert.equal(r.status, 200, path);
  }
});
