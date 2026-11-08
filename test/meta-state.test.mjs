import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { page } from "../build-fleet-meta.mjs";

const dir = mkdtempSync(join(tmpdir(), "meta-"));
// Files as pedal#636 writes them ("meta-rollout-report/1"), every sensitive field present, to prove none is carried.
const base = { schema: "meta-rollout-report/1", generated_at: "2026-11-07T17:00:00Z", account_id: "act_1234567890" };
writeFileSync(join(dir, "acme-widgets.json"), JSON.stringify({ ...base, client: "Acme Widgets", state: "mixed",
  counts: { campaigns: 2, adsets: 4, ads: 9, active: 7, paused: 2, disapproved: 1, with_issues: 1 },
  totals: { spend_usd: 812.55, impressions: 4120, conversions: 31, cpa_usd: 26.2 }, plan: { daily_budget_usd: 5000, cpa_target_usd: 20 },
  flags: [{ state: "DISAPPROVED", detail: "Ad 6000111222 'Buy Acme anvils today' rejected: Lookalike 1% of buyers" }, { state: "CPA_OVER_TARGET", detail: "Free shipping" }, { state: "BOGUS", detail: "x" }] }));
writeFileSync(join(dir, "bolt-co.json"), JSON.stringify({ ...base, client: "Bolt Co", state: "error", counts: { ads: 0 }, totals: {}, plan: {}, flags: [{ state: "ACCESS_ERROR", detail: "token expired for act_99" }] }));
writeFileSync(join(dir, "zz-broken.json"), "{not json");
const out = spawnSync("python3", ["bin/meta-state.py"], { encoding: "utf8", env: { PATH: process.env.PATH, META_ROLLOUT_DIR: dir } });
const doc = JSON.parse(out.stdout);

test("meta-state: counts and statuses only, flags limited to the named set", () => {
  assert.equal(out.status, 0, out.stderr);
  assert.equal(doc.clients.length, 2);
  assert.deepEqual(doc.clients[0], { label: "Client A", state: "mixed", built: true, verified: false, live: true,
    first_hour: { impressions: 4120, delivering: true }, issues: ["CPA_OVER_TARGET", "DISAPPROVED"] });
  assert.deepEqual(doc.clients[1], { label: "Client B", state: "error", built: false, verified: false, live: false,
    first_hour: { impressions: 0, delivering: false }, issues: ["ACCESS_ERROR"] });
  assert.match(out.stderr, /zz-broken\.json/);
});
test("meta-state: output holds no client name, id, spend, audience or creative text", () => {
  for (const needle of ["Acme", "widgets", "Bolt", "act_1234567890", "6000111222", "812", "5000", "Lookalike", "anvils", "shipping", "act_99", "expired", "rejected", "26.2", "account_id", "detail", "BOGUS"]) {
    assert.doesNotMatch(out.stdout, new RegExp(needle, "i"), needle);
  }
});
test("meta-state: the committed fixture has the same shape and no names", () => {
  const fx = JSON.parse(readFileSync("fleet/meta-fixture.json", "utf8"));
  assert.equal(fx.clients.length, 3);
  assert.deepEqual(Object.keys(fx.clients[0]), Object.keys(doc.clients[0]));
  assert.ok(fx.clients.every((c) => /^Client [A-Z]$/.test(c.label)));
});
test("meta page: renders the fixture, noindex, and is not linked from the public hub", () => {
  const html = page(JSON.parse(readFileSync("fleet/meta-fixture.json", "utf8")));
  assert.match(html, /Client C/);
  assert.match(html, /noindex/);
  for (const f of ["bio.json", "build.mjs", "public/robots.txt"]) if (existsSync(f)) assert.doesNotMatch(readFileSync(f, "utf8"), /fleet\/meta/);
});
test("fleet-kv dry run also names the meta.json key", () => {
  const r = spawnSync("bash", ["bin/fleet-kv.sh"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, FLEET_STATE_JSON: "fleet/fixture.json", META_STATE_JSON: "fleet/meta-fixture.json" } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /KV key "meta\.json"/);
});
