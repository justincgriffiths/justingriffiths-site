import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

execFileSync("node", ["build.mjs"], { cwd: new URL("../", import.meta.url), stdio: "ignore" });
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

test("nav has a Lab anchor between Work and the influences section", () => {
  const nav = html.slice(html.indexOf('<nav class="index"'), html.indexOf("</nav>"));
  assert.match(nav, /href="#lab"/);
  assert.ok(nav.indexOf("#work") < nav.indexOf("#lab") && nav.indexOf("#lab") < nav.indexOf("#influences"));
});

test("Lab section lists Qwen rollout and Fleet", () => {
  const lab = html.slice(html.indexOf('id="lab"'), html.indexOf('id="influences"'));
  assert.match(lab, /href="\/qwen\/"[^>]*>Qwen rollout/);
  assert.match(lab, /href="\/fleet\/"[^>]*>Fleet/);
  assert.match(lab, /Sign-in required/);
});

test(".info link points at /archive/", () => {
  assert.ok(!html.includes("justingriffiths.info"));
  assert.match(html, /href="\/archive\/"/);
});
