import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (env) => spawnSync("bash", ["bin/fleet-kv.sh"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } });

test("fleet-kv dry run names the key and byte count, writes nothing, shows no secret", () => {
  const r = run({ FLEET_STATE_JSON: "fleet/fixture.json", CLOUDFLARE_API_TOKEN: "sekret-token-value", FLEET_KV_NAMESPACE_ID: "nsid-value" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /would PUT \d+ bytes to KV key "state\.json"/);
  assert.doesNotMatch(r.stdout + r.stderr, /sekret-token-value|nsid-value/);
});
test("fleet-kv refuses output that is not a JSON object", () => {
  const r = run({ FLEET_STATE_JSON: "package.json.nope" });
  assert.notEqual(r.status, 0);
});
