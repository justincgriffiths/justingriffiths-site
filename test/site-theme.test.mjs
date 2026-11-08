// site#60: the /marketing-101/ theme site-wide, a step less round; serif sentences, sans titles;
// /pedal-design/ keeps the DS; /qwen/ shows when its numbers were read.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

test("corners: one set of site radii, each smaller than the marketing-101 original", () => {
  const t = read("src/tokens.css");
  assert.match(t, /--site-radius-box: var\(--radius-md\)/); // 10px, was 14px (--radius-sticker-md)
  assert.match(t, /--site-radius-inner: var\(--radius-sm\)/); // 6px, was 8px
  assert.match(t, /--site-radius-control: 12px/); // was a pill
  for (const f of ["content/marketing-101/page.css", "src/style.css"]) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /radius-sticker|radius-pill|border-radius:\s*\d+px/, f);
  }
});

test("serif for sentences, sans for titles; /pedal-design/ stays all sans", () => {
  const chrome = read("src/chrome.css");
  assert.match(chrome, /body:not\(\.skin-pedal\) \{ font-family: var\(--site-prose-font\)/);
  assert.match(chrome, /h1, h2, h3, h4, h5, h6,[^{]*\{ font-family: var\(--site-font\); \}/);
  assert.match(read("content/marketing-101/page.css"), /font-family: var\(--site-prose-font\)/);
  assert.match(read("dist/pedal-design/index.html"), /<body class="skin-pedal">/);
  assert.match(read("dist/index.html"), /family=Newsreader/);
});

test("/qwen/ prints its as-of time; a missing stamp says so instead of hiding", () => {
  const data = JSON.parse(read("content/qwen/data.json"));
  assert.match(data.as_of, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  const html = read("dist/qwen/index.html");
  assert.match(html, new RegExp(`<p class="asof cluster" data-asof="${data.as_of}">`));
  assert.match(html, /Data as of <time datetime="[^"]+">[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d\d [AP]M E[SD]T<\/time>/);
  assert.match(html, /labeling GitHub issues/);
});

test("qwen-state.py stamps as_of (pinnable for tests); the refresh runs every two hours", () => {
  const out = execFileSync("python3", ["bin/qwen-state.py"], { cwd: root, env: { ...process.env, QWEN_AS_OF: "2026-01-02T03:04:05Z" } }).toString();
  assert.equal(JSON.parse(out).as_of, "2026-01-02T03:04:05Z");
  const hours = [...read("bin/com.justin.qwen-refresh.plist").matchAll(/<key>Hour<\/key><integer>(\d+)<\/integer>/g)].map((m) => +m[1]);
  assert.deepEqual(hours, [8, 10, 12, 14, 16, 18, 20, 22]);
});
