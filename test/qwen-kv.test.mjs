import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import worker from "../src/worker.js";

// site#78: bin/qwen-kv.sh puts the leakchecked aggregates in KV; the Worker serves them; the page re-renders from them.
const dir = mkdtempSync(join(tmpdir(), "qkv-"));
const good = JSON.parse(readFileSync("content/qwen/data.json", "utf8"));
const file = (name, data) => { const f = join(dir, name); writeFileSync(f, typeof data === "string" ? data : JSON.stringify(data)); return f; };
// A curl that records its arguments and the body it was sent, and answers like the KV API. Nothing leaves the machine.
const stubDir = join(dir, "stub"); mkdirSync(stubDir);
writeFileSync(join(stubDir, "curl"), `#!/bin/sh
echo "$@" >> "$CURL_CALLS"
for a in "$@"; do case "$a" in @*) cat "\${a#@}" > "$CURL_BODY";; esac; done
echo '{"success":true,"errors":[]}'
`, { mode: 0o755 });
chmodSync(join(stubDir, "curl"), 0o755);
// An npx that stands in for `npx wrangler kv key put`: records its arguments and the --path file. Nothing leaves the machine.
writeFileSync(join(stubDir, "npx"), `#!/bin/sh
echo "$@" >> "$CURL_CALLS"
prev=""; for a in "$@"; do [ "$prev" = "--path" ] && cat "$a" > "$CURL_BODY"; prev="$a"; done
`, { mode: 0o755 });
chmodSync(join(stubDir, "npx"), 0o755);
let n = 0;
const kv = (env, ...args) => {
  const state = join(dir, "state" + n++), calls = join(dir, "calls" + n), body = join(dir, "body" + n);
  const r = spawnSync("bash", ["bin/qwen-kv.sh", ...args], { encoding: "utf8", env: {
    // qwen-kv.sh puts /opt/homebrew/bin ahead of PATH, so the npx stub is passed by path, never found on PATH.
    PATH: stubDir + ":" + process.env.PATH, QWEN_KV_NPX: join(stubDir, "npx"), HOME: process.env.HOME, QWEN_KV_STATE: state, CURL_CALLS: calls, CURL_BODY: body,
    QWEN_KV_REMOTE: process.cwd(), QWEN_KV_REF: "HEAD",
    CLOUDFLARE_API_TOKEN: "sekret-token-value", FLEET_KV_NAMESPACE_ID: "nsid-value", FLEET_KV_DIR: join(dir, "nocfg"), ...env } });
  return { ...r, state, called: existsSync(calls), calls: existsSync(calls) ? readFileSync(calls, "utf8") : "", sent: existsSync(body) ? readFileSync(body, "utf8") : null };
};

test("clean data is put to KV key qwen/data.json with a 1-hour TTL, and no secret is printed", () => {
  const r = kv({ QWEN_KV_DATA: file("good.json", good) });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.calls, /values\/qwen%2Fdata\.json\?expiration_ttl=3600/);
  assert.deepEqual(JSON.parse(r.sent), good);
  assert.doesNotMatch(r.stdout + r.stderr, /sekret-token-value|nsid-value/);
});

test("the same document twice writes once (sha256 gate)", () => {
  const f = file("same.json", good), state = join(dir, "same-state");
  const a = kv({ QWEN_KV_DATA: f, QWEN_KV_STATE: state });
  const b = kv({ QWEN_KV_DATA: f, QWEN_KV_STATE: state });
  assert.equal(a.called, true); assert.equal(b.status, 0); assert.equal(b.called, false); assert.match(b.stdout, /unchanged/);
});

test("a planted per-message field or address blocks the put: exit 1, no KV call, value not echoed", () => {
  for (const bad of [{ ...good, subject: "SENTINEL SUBJECT" }, { ...good, note: "sender-sentinel@example.com" }, { ...good, breakdowns: { ...good.breakdowns, extra: { title: "SENTINEL_T" } } }]) {
    const r = kv({ QWEN_KV_DATA: file("bad.json", bad) });
    assert.equal(r.status, 1); assert.match(r.stdout, /PRIVACY GATE BLOCKED/);
    assert.equal(r.called, false, "curl was called");
    assert.doesNotMatch(r.stdout + r.stderr, /SENTINEL|sentinel@/);
    assert.ok(!existsSync(join(r.state, "last-put.sha256")));
  }
});

test("a poisoned real source never reaches the put: the exporter whitelist and the leakcheck both stand in the way", () => {
  const runs = join(dir, "runs"); mkdirSync(runs);
  writeFileSync(join(runs, "20261108-100000-SENTINEL_ACCOUNT.json"), JSON.stringify({ mode: "create", qwen: { cap: 1, seen: 2, qwen: 1, escalated: 1, reasons: { "SENTINEL REASON free text 8841": 1 } } }));
  writeFileSync(join(runs, "20261108-100000-SENTINEL_ACCOUNT.audit.jsonl"), JSON.stringify({ tool: "qwen_classify", id: "SENTINEL_MSGID", subject: "SENTINEL SUBJECT", from: "sender-sentinel@example.com", label: "SENTINEL SUBJECT", escalated: false, latency_ms: 900 }) + "\n");
  const empty = file("empty.log", "");
  const r = kv({ QWEN_RUNS: runs, QWEN_COST_DB: join(dir, "none.db"), QWEN_TAG_LOG: empty, QWEN_TAG_JSONL: empty, QWEN_CRON_RUNS: empty, QWEN_DECLUTTER: empty, QWEN_REAP: empty });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.called, true);
  assert.doesNotMatch(r.sent, /SENTINEL|sentinel@/);
});

test("exporter failure writes nothing", () => {
  const r = kv({ QWEN_KV_DATA: file("notjson.txt", "not json") });
  assert.equal(r.status, 1); assert.equal(r.called, false);
});

test("--dry-run names the key and bytes and writes nothing", () => {
  const r = kv({ QWEN_KV_DATA: file("dry.json", good) }, "--dry-run");
  assert.equal(r.status, 0); assert.equal(r.called, false);
  assert.match(r.stdout, /would PUT \d+ bytes to KV key "qwen\/data\.json" \(ttl 3600s\)/);
});

test("a token file that is not mode 0600 is refused", () => {
  const d = mkdtempSync(join(tmpdir(), "qkvcfg-"));
  writeFileSync(join(d, "fleet-kv.token"), "sekret-file-token\n"); chmodSync(join(d, "fleet-kv.token"), 0o644);
  const r = kv({ QWEN_KV_DATA: file("m.json", good), CLOUDFLARE_API_TOKEN: "", FLEET_KV_DIR: d });
  assert.equal(r.status, 1); assert.match(r.stdout, /mode 0600/); assert.equal(r.called, false);
  assert.doesNotMatch(r.stdout + r.stderr, /sekret-file-token/);
});

test("the log line carries the real exit code, not the timestamp subshell's", () => {
  kv({ QWEN_KV_DATA: file("notjson2.txt", "not json") });
  const last = readFileSync("bin/qwen-kv.log", "utf8").trim().split("\n").pop();
  assert.match(last, /exit=1 msg="document is not a JSON object"/);
});

// Worker: KV first, built asset as the fallback.
const assets = { fetch: async (r) => new Response(`asset:${new URL(r.url).pathname}`) };
const hit = (env) => worker.fetch(new Request("https://justingriffiths.com/qwen/data.json"), { ASSETS: assets, ...env });
test("worker: /qwen/data.json is served from KV, public, with a short cache", async () => {
  const r = await hit({ FLEET_KV: { get: async (k) => (k === "qwen/data.json" ? '{"as_of":"live"}' : null) } });
  assert.equal(await r.text(), '{"as_of":"live"}');
  assert.match(r.headers.get("content-type"), /application\/json/); assert.equal(r.headers.get("cache-control"), "public, max-age=60");
});
test("worker: a missing key, an expired key, a KV error or no binding falls back to the built asset", async () => {
  for (const env of [{ FLEET_KV: { get: async () => null } }, { FLEET_KV: { get: async () => { throw new Error("kv down"); } } }, {}])
    assert.equal(await (await hit(env)).text(), "asset:/qwen/data.json");
});
test("worker: /qwen/data.json needs no Access token; /fleet/ keeps its gate", async () => {
  assert.equal((await hit({ FLEET_KV: { get: async () => "{}" } })).status, 200);
  const g = await worker.fetch(new Request("https://justingriffiths.com/fleet/state.json"), { ASSETS: assets, FLEET_KV: { get: async () => "{}" } });
  assert.equal(g.status, 404);
});

// Page: the inlined script pulls /qwen/data.json and re-renders; a bad pull leaves the page alone.
function pageScript() {
  const html = readFileSync("dist/qwen/index.html", "utf8");
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("renderData"));
}
function runPage(response) {
  const body = { innerHTML: "OLD" }, extra = { innerHTML: "OLD" }, timers = [];
  const doc = { hidden: false, getElementById: () => body, querySelector: (q) => (q === ".asof" ? null : extra), addEventListener() {} };
  const ctx = { document: doc, Date, Intl, JSON, Math, isNaN, String, Object, Array, Number, setInterval: (f, ms) => timers.push([f, ms]), fetch: async () => response };
  vm.runInNewContext(pageScript(), ctx);
  return { body, extra, timers };
}
test("page: re-renders from /qwen/data.json every 5 minutes", async () => {
  assert.ok(pageScript(), "the page has the live script");
  const { body, extra, timers } = runPage({ ok: true, json: async () => ({ ...good, as_of: "2026-11-08T16:00:00Z" }) });
  const pull = timers.find(([, ms]) => ms === 300000)[0];
  await pull();
  assert.match(body.innerHTML, /id="share"/); assert.match(extra.innerHTML, /data-asof="2026-11-08T16:00:00Z"/);
});
test("page: a failed or malformed pull leaves the rendered page as it is", async () => {
  for (const res of [{ ok: false, json: async () => ({}) }, { ok: true, json: async () => ({ nope: 1 }) }, { ok: true, json: async () => { throw new Error("bad json"); } }]) {
    const { body, timers } = runPage(res);
    await timers.find(([, ms]) => ms === 300000)[0]();
    assert.equal(body.innerHTML, "OLD");
  }
});

test("no token: the put goes through the logged-in wrangler, to the wrangler.jsonc namespace, still behind the leakcheck", () => {
  const ok = kv({ QWEN_KV_DATA: file("good-wr.json", good), CLOUDFLARE_API_TOKEN: "", FLEET_KV_NAMESPACE_ID: "" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.calls, /wrangler kv key put qwen\/data\.json --path \S+ --namespace-id 7683fca9f60d446cb3799db66178df15 --ttl 3600 --remote/);
  assert.deepEqual(JSON.parse(ok.sent), good);
  assert.match(ok.stdout, /via wrangler/);
  const bad = kv({ QWEN_KV_DATA: file("bad-wr.json", { ...good, subject: "SENTINEL SUBJECT" }), CLOUDFLARE_API_TOKEN: "", FLEET_KV_NAMESPACE_ID: "" });
  assert.equal(bad.status, 1); assert.match(bad.stdout, /PRIVACY GATE BLOCKED/);
  assert.equal(bad.called, false, "wrangler was called");
});

// site#106: the exporter and renderer come from a fresh snapshot of origin/main, never the checkout, and the document must carry every key the renderer reads.
const { history, calls_by_day, ...old } = good; // what the stale exporter wrote
test("a document missing keys the renderer reads is refused: exit 1, no put, names the keys", () => {
  for (const doc of [old, { ...good, history: undefined }]) {
    const r = kv({ QWEN_KV_DATA: file("nokeys.json", doc) });
    assert.equal(r.status, 1, r.stdout); assert.match(r.stdout, /lacks keys the renderer reads: .*history/);
    assert.equal(r.called, false, "KV was called"); assert.ok(!existsSync(join(r.state, "last-put.sha256")));
  }
  assert.match(kv({ QWEN_KV_DATA: file("nokeys2.json", old) }).stdout, /calls_by_day/);
});
test("the required keys are derived from the renderer in the snapshot, not a hand list", () => {
  const r = spawnSync("bash", ["-c", `git grep -o '\\bdata\\.[a-z_]*' HEAD -- src/qwen-render.mjs | sed 's/.*data\\.//' | sort -u`], { encoding: "utf8" });
  for (const k of ["history", "calls_by_day", "share_by_day", "breakdowns"]) assert.match(r.stdout, new RegExp("^" + k + "$", "m"));
});
// A throwaway origin: the real renderer and leakcheck, plus a stub exporter whose output we choose.
function remote(doc) {
  const d = mkdtempSync(join(tmpdir(), "qkvrem-")); mkdirSync(join(d, "src")); mkdirSync(join(d, "bin"));
  copyFileSync("src/qwen-render.mjs", join(d, "src/qwen-render.mjs")); copyFileSync("bin/qwen-leakcheck.py", join(d, "bin/qwen-leakcheck.py"));
  writeFileSync(join(d, "bin/qwen-state.py"), `import sys\nsys.stdout.write(${JSON.stringify(JSON.stringify(doc))})\n`);
  const g = (...a) => execFileSync("git", ["-C", d, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { stdio: "pipe" });
  g("init", "-q", "-b", "main"); g("add", "-A"); g("commit", "-q", "-m", "x");
  return d;
}
test("the export runs the exporter from the fetched ref: a stale one is refused, a current one is put", () => {
  const stale = kv({ QWEN_KV_REMOTE: remote(old), QWEN_KV_REF: "main" });
  assert.equal(stale.status, 1); assert.match(stale.stdout, /lacks keys/); assert.equal(stale.called, false);
  const fresh = kv({ QWEN_KV_REMOTE: remote(good), QWEN_KV_REF: "main" });
  assert.equal(fresh.status, 0, fresh.stdout); assert.equal(fresh.called, true); assert.deepEqual(JSON.parse(fresh.sent), good);
});
test("a failed fetch refuses the export: exit 1, no put, even with data supplied", () => {
  for (const env of [{ QWEN_KV_REMOTE: join(dir, "no-such-repo") }, { QWEN_KV_REF: "no-such-ref" }]) {
    const r = kv({ QWEN_KV_DATA: file("fetchfail.json", good), ...env });
    assert.equal(r.status, 1); assert.match(r.stdout, /fetch failed/); assert.equal(r.called, false);
  }
});
