// The hub renders twice (light lane at /, night lane at /pedal-design/) and the two are linked by a switch.
// These tests build into dist/ and check that every switch and site-nav link resolves through the Worker.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import worker from "../src/worker.js";

const dist = (p) => new URL(`../dist/${p}`, import.meta.url);
before(() => execFileSync("node", ["build.mjs"], { cwd: new URL("..", import.meta.url), stdio: "ignore" }));

const hrefs = (html, cls) => {
  const block = html.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)</span>`))[1];
  return [...block.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
};
const classic = () => readFileSync(dist("index.html"), "utf8");
const pedal = () => readFileSync(dist("pedal-design/index.html"), "utf8");

// Serves dist/ the way the Worker's ASSETS binding does: a directory path answers with its index.html.
const assets = { fetch: async (req) => {
  let p = new URL(req.url).pathname.slice(1);
  if (p === "" || p.endsWith("/")) p += "index.html";
  return existsSync(dist(p)) ? new Response(readFileSync(dist(p))) : new Response("nf", { status: 404 });
} };
const get = (path) => worker.fetch(new Request(`https://justingriffiths.com${path}`), { ASSETS: assets });

test("both versions carry the Light | Night switch, the current one marked", () => {
  assert.deepEqual(hrefs(classic(), "switch"), ["/", "/pedal-design/"]);
  assert.deepEqual(hrefs(pedal(), "switch"), ["/", "/pedal-design/"]);
  assert.match(classic(), /<a href="\/" data-skin="classic" aria-current="page">/);
  assert.match(pedal(), /<a href="\/pedal-design\/" data-skin="pedal" aria-current="page">/);
});

test("switch links resolve through the Worker, public, with a 200", async () => {
  for (const path of ["/", "/pedal-design/", "/pedal-design/style.css"]) {
    const r = await get(path);
    assert.equal(r.status, 200, path);
  }
});

test("/pedal-design without the slash redirects to it", async () => {
  const r = await get("/pedal-design");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://justingriffiths.com/pedal-design/");
});

test("site nav links to /qwen/ and /fleet/ on both versions", () => {
  for (const html of [classic(), pedal()]) assert.deepEqual(hrefs(html, "site-links"), ["/qwen/", "/fleet/"]);
});

test("both versions render the same sections, in the same order", () => {
  const ids = (h) => [...h.matchAll(/<section class="section" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(pedal()), ids(classic()));
  assert.ok(ids(pedal()).length > 0);
});

test("the switch keeps the section anchor (script updates the hash on both links)", () => {
  assert.match(pedal(), /\.switch a/);
  assert.match(pedal(), /hashchange/);
});

test("pedal version uses the Pedal stylesheet, not the hub one", () => {
  assert.match(pedal(), /href="\/pedal-design\/style\.css"/);
  assert.doesNotMatch(pedal(), /href="\/style\.css"/);
});
