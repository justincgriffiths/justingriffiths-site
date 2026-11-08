// site#60: Shallan, Justin's own design system. A fork of the Pedal DS night lane with its own :root;
// every personal page reads it, /pedal-design/ does not.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

const defined = (css) => new Set([...strip(css).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const used = (text) => new Set([...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));

test("shallan.css stands alone: its own :root, every var() it reads it defines, no import", () => {
  const s = read("src/shallan.css");
  assert.match(s, /^:root \{/m);
  assert.doesNotMatch(strip(s), /@import|tokens\.css/);
  const d = defined(s);
  for (const n of used(strip(s))) assert.ok(d.has(n), `shallan.css reads ${n} but does not define it`);
});

test("every token a personal page reads is defined in Shallan", () => {
  const d = defined(read("src/shallan.css"));
  const files = ["src/chrome.css", "src/style.css", "content/qwen/page.css", "content/marketing-101/page.css", "content/archive/page.css", "build-qwen.mjs", "build-fleet-meta.mjs"];
  const local = new Set(["--aspect"]); // set inline per exhibit
  for (const f of files) for (const n of used(read(f))) if (!local.has(n)) assert.ok(d.has(n), `${f} reads ${n}, missing from shallan.css`);
});

test("fork values match the Pedal DS night lane at the fork point", () => {
  const s = read("src/shallan.css");
  for (const [n, v] of [["--night-800", "#1A1A2E"], ["--night-900", "#12121F"], ["--paper", "#FAF8F4"], ["--teal-500", "#5DA490"], ["--orange-500", "#F4845F"], ["--night-grid-size", "64px"]]) {
    assert.match(s, new RegExp(`${n}:\\s*${v};`), n);
  }
});

test("design/shallan: @dsCard preview cards for colors, type, radii, box and pill button, on a synced copy", () => {
  const dir = new URL("design/shallan/", root);
  const cards = readdirSync(dir).filter((f) => f.endsWith(".card.html"));
  for (const k of ["colors", "type", "radii", "box", "button"]) assert.ok(cards.some((c) => c.startsWith(k)), `no ${k} card`);
  for (const c of cards) {
    const html = read(`design/shallan/${c}`);
    assert.match(html.split("\n")[0], /^<!-- @dsCard group="[^"]+"/, c);
    assert.match(html, /href="shallan\.css"/, c);
  }
  assert.equal(read("design/shallan/shallan.css"), read("src/shallan.css"));
});

test("the name is Shallan everywhere; the superseded name appears nowhere", () => {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root }).toString().split("\n")
    .filter((f) => f && !f.startsWith("dist/") && /\.(css|mjs|js|md|html|json)$/.test(f) && f !== "test/shallan.test.mjs");
  const bad = ["night", "grid"].join(""); // spelled apart so this file does not match itself
  for (const f of files) assert.doesNotMatch(read(f).toLowerCase(), new RegExp(bad), f);
  assert.match(read("docs/shallan.md"), /^# Shallan/m);
});
