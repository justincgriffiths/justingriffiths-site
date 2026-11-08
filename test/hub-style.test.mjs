// site#51: the hub reads one token layer, and (site#49) the cover never reserves a portrait column it does not use.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

test("src/style.css and src/chrome.css carry no hex colors or font names; tokens.css owns them", () => {
  for (const f of ["src/style.css", "src/chrome.css", "src/frame.css", "src/pedal-design.css"]) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, f);
    assert.doesNotMatch(css, /Google Sans|IBM Plex|Source Serif|rgba?\(/, f);
  }
});

test("dist/site.css is tokens.css, chrome.css, then frame.css; dist/style.css is the hub rules", () => {
  assert.equal(read("dist/site.css"), [read("src/tokens.css"), read("src/chrome.css"), read("src/frame.css")].join("\n"));
  assert.equal(read("dist/style.css"), read("src/style.css"));
});

test("dark only: one night default, no light lane alias, no theme switch (Justin, 2026-11-08)", () => {
  const t = read("src/tokens.css");
  assert.match(t, /--site-bg:\s+var\(--surface-night\)/);
  assert.match(t, /color-scheme: dark/);
  assert.doesNotMatch(read("dist/index.html"), /class="switch"|Light<\/a>|Night<\/a>/);
});

test("tokens.css ships the Pedal defaults and a commented jg theme stub", () => {
  const t = read("src/tokens.css");
  assert.match(t, /--accent:\s+var\(--teal-500\)/);
  assert.match(t, /\/\*[^]*\[data-theme="jg"\][^]*\*\//);
});

test("site#49: no empty cover column. Without a portrait the second column is the hero visual card; the portrait column is gated on :has(.portrait)", () => {
  const bio = JSON.parse(read("bio.json"));
  const html = read("dist/index.html");
  const cover = html.slice(html.indexOf('<div class="cover-body'), html.indexOf('<nav class="index'));
  if (!bio.dossier.cover?.portrait) {
    assert.doesNotMatch(html, /class="exhibit[^"]*portrait/);
    assert.match(cover, /class="cover-visual[ "]/); // the column is filled
  }
  const css = read("src/style.css");
  // the portrait column is a dial change (--switcher-g1/g2) on .cover-body:has(.portrait), never on .cover-body itself
  assert.match(css, /\.cover-body:has\(\.portrait\)\s*\{[^}]*--switcher-g1/);
  assert.doesNotMatch(css, /\.cover-body\s*\{[^}]*grid-template-columns/);
});

test("the hub loads Google Sans, not the retired classic faces", () => {
  const html = read("dist/index.html");
  assert.match(html, /family=Google\+Sans/);
  assert.doesNotMatch(html, /IBM\+Plex|Source\+Serif/);
});
