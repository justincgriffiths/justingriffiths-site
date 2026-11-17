// /design-systems/: the ◐SHALLAN gallery (bin/ds-sync.sh) on the site chrome. Every system in systems.json gets a
// card, a thumbnail and its own page, and every one of them answers through the Worker.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import worker from "../src/worker.js";

const root = new URL("..", import.meta.url);
const dist = (p) => new URL(`../dist/${p}`, import.meta.url);
const systems = JSON.parse(readFileSync(new URL("../content/design-systems/systems.json", import.meta.url), "utf8"));
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

const assets = { fetch: async (req) => {
  let p = new URL(req.url).pathname.slice(1);
  if (p.endsWith("/")) p += "index.html";
  return existsSync(dist(p)) ? new Response(readFileSync(dist(p))) : new Response("nf", { status: 404 });
} };
const get = (path) => worker.fetch(new Request(`https://justingriffiths.com${path}`), { ASSETS: assets });

test("the index lists every synced system once, baseline first", () => {
  const html = readFileSync(dist("design-systems/index.html"), "utf8");
  for (const s of systems) {
    assert.equal(html.split(`href="/design-systems/${s.slug}.html"`).length - 1, 2, `${s.slug}: thumbnail and title links`);
    assert.ok(existsSync(dist(`design-systems/thumbs/${s.slug}.jpg`)), `${s.slug}: thumbnail`);
  }
  assert.equal(systems[0].kind, "baseline");
});

test("the index, each system page and each thumbnail answer 200; the bare path redirects", async () => {
  for (const path of ["/design-systems/", ...systems.flatMap((s) => [`/design-systems/${s.slug}.html`, `/design-systems/thumbs/${s.slug}.jpg`])]) {
    assert.equal((await get(path)).status, 200, path);
  }
  const r = await get("/design-systems");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://justingriffiths.com/design-systems/");
});

test("no brand font files ship: Google Sans comes from Google Fonts", () => {
  const pedal = readFileSync(dist("design-systems/pedal.html"), "utf8");
  assert.match(pedal, /fonts\.googleapis\.com\/css2\?family=Google\+Sans/);
  const files = execFileSync("find", ["dist/design-systems", "-name", "*.ttf", "-o", "-name", "*.otf", "-o", "-name", "*.woff*"], { cwd: root, encoding: "utf8" });
  assert.equal(files.trim(), "");
});
