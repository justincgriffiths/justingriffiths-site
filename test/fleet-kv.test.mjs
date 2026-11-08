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
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("fleet-kv unattended: a token file that is not mode 0600 is refused, and the token never prints", () => {
  const d = mkdtempSync(join(tmpdir(), "fkv-"));
  writeFileSync(join(d, "fleet-kv.token"), "sekret-file-token\n"); chmodSync(join(d, "fleet-kv.token"), 0o644);
  writeFileSync(join(d, "fleet-kv.namespace-id"), "nsid-file\n");
  mkdirSync(join(d, "stub")); writeFileSync(join(d, "stub", "python3"), "#!/bin/sh\necho '{}'\n"); chmodSync(join(d, "stub", "python3"), 0o755);
  const r = spawnSync("bash", ["bin/fleet-kv.sh"], { encoding: "utf8", env: { PATH: join(d, "stub") + ":" + process.env.PATH, HOME: process.env.HOME, FLEET_KV_DIR: d } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /mode 0600/);
  assert.doesNotMatch(r.stdout + r.stderr, /sekret-file-token|nsid-file/);
});
test("fleet-kv missing credentials fails with a plain message", () => {
  const d = mkdtempSync(join(tmpdir(), "fkv-"));
  mkdirSync(join(d, "stub")); writeFileSync(join(d, "stub", "python3"), "#!/bin/sh\necho '{}'\n"); chmodSync(join(d, "stub", "python3"), 0o755);
  const r = spawnSync("bash", ["bin/fleet-kv.sh"], { encoding: "utf8", env: { PATH: join(d, "stub") + ":" + process.env.PATH, HOME: process.env.HOME, FLEET_KV_DIR: d } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no CLOUDFLARE_API_TOKEN/);
});
test("plist does not call op (Touch ID fails unattended) and ships unloaded", () => {
  const p = readFileSync("bin/com.justin.fleet-kv.plist", "utf8");
  assert.doesNotMatch(p, /<string>[^<]*\/op<\/string>/);
  assert.match(p, /<key>RunAtLoad<\/key><false\/>/);
});
test("wrangler.jsonc: FLEET_KV is either commented out or bound to a real 32-hex id", () => {
  const w = readFileSync("wrangler.jsonc", "utf8");
  const live = w.split("\n").filter((l) => !l.trim().startsWith("//") && l.includes("FLEET_KV"));
  for (const l of live) assert.match(l, /"id":\s*"[0-9a-f]{32}"/);
});
