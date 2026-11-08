// The dossier renders twice (/ and /pedal-design/), both night lane, both on the shared site chrome.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import worker from "../src/worker.js";

const dist = (p) => new URL(`../dist/${p}`, import.meta.url);
before(() => execFileSync("node", ["build.mjs"], { cwd: new URL("..", import.meta.url), stdio: "ignore" }));

const classic = () => readFileSync(dist("index.html"), "utf8");
const pedal = () => readFileSync(dist("pedal-design/index.html"), "utf8");

// Serves dist/ the way the Worker's ASSETS binding does: a directory path answers with its index.html.
const assets = { fetch: async (req) => {
  let p = new URL(req.url).pathname.slice(1);
  if (p === "" || p.endsWith("/")) p += "index.html";
  return existsSync(dist(p)) ? new Response(readFileSync(dist(p))) : new Response("nf", { status: 404 });
} };
const get = (path) => worker.fetch(new Request(`https://justingriffiths-site.jg-personal.workers.dev${path}`), { ASSETS: assets });

test("no Light | Night switch on either version: dark only (Justin, 2026-11-08)", () => {
  for (const html of [classic(), pedal()]) assert.doesNotMatch(html, /class="switch"|data-skin=/);
});

test("both versions and their stylesheets resolve through the Worker, public, with a 200", async () => {
  for (const path of ["/", "/site.css", "/style.css", "/pedal-design/", "/pedal-design/style.css"]) {
    const r = await get(path);
    assert.equal(r.status, 200, path);
  }
});

test("/pedal-design without the slash redirects to it", async () => {
  const r = await get("/pedal-design");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://justingriffiths-site.jg-personal.workers.dev/pedal-design/");
});

test("both versions render the same sections, in the same order", () => {
  const ids = (h) => [...h.matchAll(/<section class="section[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(pedal()), ids(classic()));
  assert.ok(ids(pedal()).length > 0);
});

test("pedal version uses the Pedal stylesheet, not the hub one", () => {
  assert.match(pedal(), /href="\/pedal-design\/style\.css"/);
  assert.doesNotMatch(pedal(), /href="\/style\.css"/);
});
