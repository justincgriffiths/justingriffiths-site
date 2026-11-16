// /cookbook/: the renderer (build-cookbook.mjs) on a made-up fixture recipe, and the Worker gate. Real recipes
// never enter this public repo, so the fixture is invented.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import { resetKeyCache } from "../src/access.js";
import { frontMatter, renderCookbook, timers } from "../build-cookbook.mjs";

const FIX = fileURLToPath(new URL("./fixtures/cookbook/", import.meta.url));

test("front matter: scalars, quotes, lists, null and the nested source map", () => {
  const { meta } = frontMatter("---\na: 1\nb: \"x: y\"\nc: [p, q]\nd: null\ne: true\nsource:\n  raw: s.txt\nf: plain\n---\nbody");
  assert.deepEqual(meta, { a: 1, b: "x: y", c: ["p", "q"], d: null, e: true, source: { raw: "s.txt" }, f: "plain" });
});

test("render: index plus one page per recipe, escaped, with the original folded in", () => {
  const out = renderCookbook(FIX);
  assert.deepEqual(Object.keys(out).sort(), ["index.html", "test-toast/index.html"]);
  const page = out["test-toast/index.html"];
  assert.match(page, /<h1>Test Toast<\/h1>/);
  assert.match(page, /From Grandpa Test, adapted from A Made-Up Book/);
  assert.match(page, /<dt>Serves<\/dt><dd>2-3<\/dd>/);
  assert.match(page, /<dt>Oven<\/dt><dd>350 °F<\/dd>/);
  assert.match(page, /<h3>Bread<\/h3><ul><li>2 slices bread<\/li><li>1 tbsp <strong>butter<\/strong><\/li><\/ul>/);
  assert.match(page, /<ol><li>Toast the bread\.<\/li><li>Spread the butter &lt;b&gt;\.<\/li><\/ol>/);
  assert.match(page, /<details class="original"><summary>The original, as written<\/summary><pre>Grandpa&#39;s toast/);
  assert.match(page, /noindex, nofollow/);
  assert.match(out["index.html"], /href="\/cookbook\/test-toast\/"/);
  assert.match(out["index.html"], /1 family recipes, from Grandpa Test/);
});

test("cooking: step times become timers (longer end of a range), lists tick off, the bar and script ship", () => {
  assert.equal(timers("<li>Brown, 5–7 minutes. Add, 1 minute. Simmer 1 hour.</li>"),
    '<li>Brown, <button type="button" class="timer" data-s="420">5–7 minutes</button>. Add, <button type="button" class="timer" data-s="60">1 minute</button>. Simmer <button type="button" class="timer" data-s="3600">1 hour</button>.</li>');
  assert.equal(timers("<li>Bake 350 degrees until done.</li>"), "<li>Bake 350 degrees until done.</li>");
  const page = renderCookbook(FIX)["test-toast/index.html"];
  assert.match(page, /class="cookbar no-print"/);
  assert.match(page, /id="awake"[^>]*hidden/);
  assert.match(page, /wakeLock/);
  assert.doesNotMatch(page, /class="part part-notes check"/);
});

// Worker gate. Same token helpers as worker.test.mjs, with the Cookbook app's audience.
const TEAM = "team.cloudflareaccess.com", COOK = "cook-aud", FLEET = "fleet-aud";
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };
const certs = async () => new Response(JSON.stringify({ keys: [jwk] }));
async function token(aud) {
  const h = enc({ alg: "RS256", kid: "k1" });
  const p = enc({ aud: [aud], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600 });
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${h}.${p}`))).toString("base64url");
  return `${h}.${p}.${sig}`;
}
const PAGES = { "cookbook/index.html": "<p>index</p>", "cookbook/test-toast/index.html": "<p>toast</p>" };
const reads = [];
const kv = { get: async (k) => { reads.push(k); return PAGES[k] ?? null; } };
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: FLEET, COOKBOOK_AUD: COOK, FLEET_KV: kv, ASSETS: { fetch: async () => new Response("asset") } };
async function hit(path, aud, over = {}) {
  const headers = aud ? { "Cf-Access-Jwt-Assertion": await token(aud) } : {};
  resetKeyCache();
  const realFetch = globalThis.fetch; globalThis.fetch = certs;
  try { return await worker.fetch(new Request(`https://justingriffiths.com${path}`, { headers }), { ...env, ...over }); } finally { globalThis.fetch = realFetch; }
}

test("cookbook: no token is 404 and never reads KV", async () => {
  reads.length = 0;
  for (const p of ["/cookbook", "/cookbook/", "/cookbook/test-toast/"]) assert.equal((await hit(p)).status, 404);
  assert.equal(reads.length, 0);
});
test("cookbook: a Fleet token does not open the cookbook", async () => {
  assert.equal((await hit("/cookbook/", FLEET)).status, 404);
});
test("cookbook: a Cookbook token does not open /fleet/", async () => {
  assert.equal((await hit("/fleet/", COOK)).status, 404);
});
test("cookbook: unset COOKBOOK_AUD fails closed", async () => {
  assert.equal((await hit("/cookbook/", COOK, { COOKBOOK_AUD: undefined })).status, 404);
});
test("cookbook: a valid token gets the KV pages, private HTML", async () => {
  const r = await hit("/cookbook/", COOK);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), "<p>index</p>");
  assert.match(r.headers.get("content-type"), /text\/html/);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(await (await hit("/cookbook/test-toast/", COOK)).text(), "<p>toast</p>");
  assert.equal(await (await hit("/cookbook/test-toast/index.html", COOK)).text(), "<p>toast</p>");
});
test("cookbook: bare paths redirect to the trailing slash", async () => {
  for (const [p, to] of [["/cookbook", "/cookbook/"], ["/cookbook/test-toast", "/cookbook/test-toast/"]]) {
    const r = await hit(p, COOK);
    assert.equal(r.status, 301);
    assert.equal(new URL(r.headers.get("location")).pathname, to);
  }
});
test("cookbook: unknown, nested or odd paths are 404 and read no stray keys", async () => {
  reads.length = 0;
  for (const p of ["/cookbook/nope/", "/cookbook/a/b/", "/cookbook/Bad/", "/cookbook/x_y", "/cookbook/state.json"]) assert.equal((await hit(p, COOK)).status, 404, p);
  assert.ok(reads.every((k) => /^cookbook\/([a-z0-9-]+\/)?index\.html$/.test(k)), reads.join(","));
});
