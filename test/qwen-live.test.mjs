// The /qwen/ page pulls /qwen/data.json once on load, not only on the 5-minute timer: without the first pull a visitor
// sees the build-time snapshot (days old, marked stale) until the timer fires.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("the built page pulls the live data on load", () => {
  const r = spawnSync("node", ["build-qwen.mjs"], { cwd: new URL("../", import.meta.url), encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const html = readFileSync(new URL("../dist/qwen/index.html", import.meta.url), "utf8");
  const boot = html.slice(html.lastIndexOf("age();"));
  assert.match(boot, /^age\(\);pull\(\);/);
  assert.match(boot, /setInterval\(pull,300000\)/);
});
