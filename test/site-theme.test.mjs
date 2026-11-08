// site#60: the /marketing-101/ theme site-wide, a step less round; serif sentences, sans titles;
// /pedal-design/ keeps the DS; /qwen/ shows when its numbers were read.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

test("corners: Shallan is a step less round than marketing-101 (14->10, 8->6), pills stay pills", () => {
  const s = read("src/shallan.css");
  assert.match(s, /--shallan-radius-box: 10px;/); // was 14px (--radius-sticker-md)
  assert.match(s, /--shallan-radius-inner: 6px;/); // was 8px (--radius-sticker-sm)
  assert.match(s, /--shallan-radius-pill: 999px;/); // unchanged (issue comment 6719304207)
  assert.match(s, /--site-radius-control: var\(--shallan-radius-pill\)/);
  for (const f of ["content/marketing-101/page.css", "src/style.css"]) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /radius-sticker|radius-pill|border-radius:\s*\d+px/, f);
  }
});

test("serif for sentences, sans for titles, one-line revert; /pedal-design/ stays all sans", () => {
  const s = read("src/shallan.css");
  assert.match(s, /^\s*--shallan-sentence-face: var\(--font-serif\);$/m);
  assert.match(s, /--site-prose-font: var\(--shallan-sentence-face\)/);
  const chrome = read("src/chrome.css");
  assert.match(chrome, /body \{ font-family: var\(--site-prose-font\)/);
  assert.match(chrome, /h1, h2, h3, h4, h5, h6,[^{]*\{ font-family: var\(--site-font\); \}/);
  assert.match(read("content/marketing-101/page.css"), /font-family: var\(--site-prose-font\)/);
  assert.match(read("src/tokens.css"), /--site-prose-font: var\(--font-sans\)/);
  assert.doesNotMatch(read("src/tokens.css"), /--font-serif/);
  assert.match(read("dist/index.html"), /family=Newsreader/);
});

test("/qwen/ prints its as-of time; a missing stamp says so instead of hiding", () => {
  const data = JSON.parse(read("content/qwen/data.json"));
  assert.match(data.as_of, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  const html = read("dist/qwen/index.html");
  assert.match(html, new RegExp(`<span class="asof" data-asof="${data.as_of}">`));
  assert.match(html, /Data as of <time datetime="[^"]+">[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d\d [AP]M E[SD]T<\/time>/);
  assert.match(html, /labeling GitHub issues/);
});

test("qwen-state.py stamps as_of (pinnable for tests); the refresh runs every two hours", () => {
  const out = execFileSync("python3", ["bin/qwen-state.py"], { cwd: root, env: { ...process.env, QWEN_AS_OF: "2026-01-02T03:04:05Z" } }).toString();
  assert.equal(JSON.parse(out).as_of, "2026-01-02T03:04:05Z");
  const hours = [...read("bin/com.justin.qwen-refresh.plist").matchAll(/<key>Hour<\/key><integer>(\d+)<\/integer>/g)].map((m) => +m[1]);
  assert.deepEqual(hours, [8, 10, 12, 14, 16, 18, 20, 22]);
});

test("/qwen/ has collapsible Background (closed) and Data (open, as-of in summary) and a quiet Learn more (site#68)", () => {
  const html = readFileSync(new URL("../dist/qwen/index.html", import.meta.url), "utf8");
  assert.match(html, /<details class="disclosure" id="background">/);
  assert.match(html, /<details class="disclosure" id="data" open>/);
  const dataSummary = html.slice(html.indexOf('id="data"'), html.indexOf("</summary>", html.indexOf('id="data"')));
  assert.match(dataSummary, /Data as of <time/);
  assert.ok(html.indexOf('id="background"') < html.indexOf('id="data"'));
  assert.match(html, /<a class="quiet-link" href="\/#about">Learn more<\/a>/);
  assert.ok(html.indexOf("Learn more") > html.indexOf('id="breakdowns"'));
});
