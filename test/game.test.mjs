import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker from "../src/worker.js";
import { resetKeyCache } from "../src/access.js";
import { page, kit } from "../build-fleet-game.mjs";
import { NAV } from "../src/chrome.mjs";

const fixture = JSON.parse(readFileSync("fleet/game-fixture.json", "utf8"));

// Gate: same Access check as the rest of /fleet/ (token helpers as test/worker.test.mjs).
const TEAM = "team.cloudflareaccess.com", AUD = "aud123";
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };
async function token() {
  const h = enc({ alg: "RS256", kid: "k1" }), p = enc({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600 });
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${h}.${p}`))).toString("base64url");
  return `${h}.${p}.${sig}`;
}
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const GAME = JSON.stringify(fixture);
const assets = { fetch: async () => new Response("<html>game page</html>") };
async function hit(path, { authed = false, kv = (k) => (k === "game/state.json" ? GAME : null) } = {}) {
  const headers = authed ? { "Cf-Access-Jwt-Assertion": await token() } : {};
  resetKeyCache();
  const real = globalThis.fetch; globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }));
  try { return await worker.fetch(new Request(`https://justingriffiths.com${path}`, { headers }), { ASSETS: assets, FLEET_KV: { get: async (k) => kv(k) }, ...env }); }
  finally { globalThis.fetch = real; }
}

test("gate: /fleet/game/ and its feed are 404 without an Access token", async () => {
  assert.equal((await hit("/fleet/game/")).status, 404);
  assert.equal((await hit("/fleet/game/state.json")).status, 404);
});
test("gate: with a token the page is served and the feed reads KV key game/state.json", async () => {
  assert.equal((await hit("/fleet/game/", { authed: true })).status, 200);
  const r = await hit("/fleet/game/state.json", { authed: true });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await r.json(), fixture);
  assert.equal((await hit("/fleet/game/state.json", { authed: true, kv: () => null })).status, 404);
});

test("page: rounds newest first, each agent's events as rows, running totals", () => {
  const html = page(fixture);
  const at = (s) => html.indexOf(s);
  assert.ok(at('id="round-3"') > 0 && at('id="round-3"') < at('id="round-2"') && at('id="round-2"') < at('id="round-1"'));
  assert.match(html, /<details class="disclosure" id="round-3" open>/);
  assert.doesNotMatch(html, /<details class="disclosure" id="round-2" open>/);
  assert.match(html, /<td>saved_run<\/td><td>\+2<\/td><td>\$0\.12<\/td><td><a href="https:\/\/example\.com\/demo\/3"/);
  assert.match(html, /<td>late<\/td><td>−2<\/td>/);
  assert.match(html, /<tr><td>●DEMO_ALPHA<\/td><td>\+6<\/td>/);
  assert.match(html, /<svg [^>]*aria-label="Points per round by agent"/);
});
test("page: How scoring works is the shared disclosure, closed, rendered from rules_md; Lessons from learnings_md", () => {
  const html = page(fixture);
  assert.match(html, /<details class="disclosure" id="scoring"><summary>.*How scoring works/);
  assert.match(html, /<h4>Scoring<\/h4>/);
  assert.match(html, /<td><code>saved_run<\/code><\/td><td>\+2<\/td>/);
  assert.match(html, /<section id="lessons">.*Name the evidence when you claim a save/s);
});
test("page: ledger text is escaped, evidence that is not a web link is text", () => {
  const evil = structuredClone(fixture);
  evil.rounds[0].events[0].lesson = "<script>x</script>"; evil.rounds[0].events[0].evidence = "javascript:alert(1)";
  evil.rules_md = "<img src=x onerror=y>";
  const { render } = kit();
  const out = render(evil);
  assert.doesNotMatch(out, /<script>x|<img src|href="javascript/);
  assert.match(out, /&lt;script&gt;x&lt;\/script&gt;/);
});
test("page: noindex, no real-data hosts, in-page refresh reads the gated feed, nav lists Game under Lab", () => {
  const html = page(fixture);
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.match(html, /fetch\("\/fleet\/game\/state\.json"/);
  const lab = NAV.find((n) => n.key === "lab");
  assert.ok(lab.items.some((i) => i.key === "game" && i.href === "/fleet/game/"));
  assert.match(html, /<a href="\/fleet\/game\/" aria-current="page"><span class="nav-sub-title">Game</);
});
test("fixture: fake only (demo agents, example.com links, masked flag)", () => {
  assert.equal(fixture.masked, true);
  const events = fixture.rounds.flatMap((r) => r.events);
  assert.ok(events.every((e) => /^●DEMO_/.test(e.agent) && (/^https:\/\/example\.com\//.test(e.evidence) || e.evidence === "no link")));
  for (const r of fixture.rounds) for (const e of r.events) assert.deepEqual(Object.keys(e), ["ts", "round", "rules", "agent", "event", "points", "usd", "evidence", "lesson"]);
});

// Exporter: a temporary ledger in the stable row shape, with an extra field and a bad line to prove both are handled.
const dir = mkdtempSync(join(tmpdir(), "game-"));
mkdirSync(join(dir, "game"));
const ev = (o) => ({ ts: "2026-01-01T10:00:00Z", round: 1, rules: "v2", agent: "●T_ONE", event: "saved_run", points: 2, usd: 0.1, evidence: "https://example.com/x", lesson: "l", ...o });
writeFileSync(join(dir, "points.jsonl"), [ev({ hour: "extra" }), ev({ agent: "●T_TWO", points: -1, ts: "2026-01-01T09:00:00Z" }), "{bad", ev({ round: 2, ts: "2026-01-01T12:30:00Z" })].map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join("\n") + "\n");
writeFileSync(join(dir, "game", "rounds.jsonl"), JSON.stringify({ round: 1, start: "2026-01-01T08:00:00Z", end: "2026-01-01T10:00:00Z", rules: "v2", points: 1, scores: 2, agents: ["x"], game_usd: 0.1, qwen_runs_ok: 3, learnings: ["a"] }) + "\n");
writeFileSync(join(dir, "game", "rules.md"), "# R\n"); writeFileSync(join(dir, "game", "learnings.md"), "- L\n");
const run = (d) => spawnSync("python3", ["bin/game-export.py"], { encoding: "utf8", env: { PATH: process.env.PATH, GAME_STATE_DIR: d } });

test("exporter: valid JSON, rounds newest first, stable fields only, totals per agent", () => {
  const out = run(dir), doc = JSON.parse(out.stdout);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(doc.schema, "game-state/1");
  assert.deepEqual(doc.rounds.map((r) => r.round), [2, 1]);
  assert.deepEqual(doc.rounds[1].events.map((e) => e.agent), ["●T_TWO", "●T_ONE"]);
  assert.deepEqual(Object.keys(doc.rounds[1].events[0]), ["ts", "round", "rules", "agent", "event", "points", "usd", "evidence", "lesson"]);
  assert.deepEqual(Object.keys(doc.rounds[1]), ["round", "start", "end", "rules", "game_usd", "learnings", "events"]);
  assert.deepEqual(doc.totals, { "●T_ONE": 4, "●T_TWO": -1 });
  assert.equal(doc.rules_md, "# R\n");
  assert.match(out.stderr, /points\.jsonl:3 skipped/);
});
test("exporter: a missing ledger is an empty document, not a crash", () => {
  const out = run(join(dir, "nowhere")), doc = JSON.parse(out.stdout);
  assert.equal(out.status, 0);
  assert.deepEqual([doc.rounds, doc.totals], [[], {}]);
  assert.ok(page(doc).includes("No rounds yet."));
});
test("game-kv.sh: dry run reports counts only and writes nothing", () => {
  const f = join(dir, "state.json"); writeFileSync(f, JSON.stringify(fixture));
  const out = spawnSync("bin/game-kv.sh", ["--dry-run"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: dir, GAME_STATE_JSON: f } });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /would PUT \d+ bytes \(3 rounds, 6 events\) to KV key "game\/state\.json"/);
  assert.doesNotMatch(out.stdout, /DEMO|example\.com/);
  const bad = join(dir, "bad.json"); writeFileSync(bad, "{}");
  assert.equal(spawnSync("bin/game-kv.sh", [], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: dir, GAME_STATE_JSON: bad } }).status, 1);
});
