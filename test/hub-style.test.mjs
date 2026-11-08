// site#51: the hub reads one token layer, and (site#49) the cover never reserves a portrait column it does not use.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

test("src/style.css carries no hex colors or font names; tokens.css owns them", () => {
  const css = read("src/style.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css, /Google Sans|IBM Plex|Source Serif|rgba?\(/);
});

test("dist/style.css is tokens.css followed by style.css", () => {
  assert.equal(read("dist/style.css"), read("src/tokens.css") + "\n" + read("src/style.css"));
});

test("tokens.css ships the Pedal defaults and a commented jg theme stub", () => {
  const t = read("src/tokens.css");
  assert.match(t, /--accent:\s+var\(--teal-500\)/);
  assert.match(t, /\/\*[^]*\[data-theme="jg"\][^]*\*\//);
});

test("site#49: with no portrait, the cover has no portrait column; the two-column grid is gated on :has(.portrait)", () => {
  const bio = JSON.parse(read("bio.json"));
  const html = read("dist/index.html");
  if (!bio.dossier.cover?.portrait) assert.doesNotMatch(html, /class="exhibit[^"]*portrait/);
  const css = read("src/style.css");
  const coverGrids = [...css.matchAll(/([^{}]*\.cover-body[^{}]*)\{[^}]*grid-template-columns/g)].map((m) => m[1].trim());
  assert.ok(coverGrids.length > 0);
  for (const sel of coverGrids) assert.match(sel, /:has\(\.portrait\)/, sel);
});

test("the hub loads Google Sans, not the retired classic faces", () => {
  const html = read("dist/index.html");
  assert.match(html, /family=Google\+Sans/);
  assert.doesNotMatch(html, /IBM\+Plex|Source\+Serif/);
});
