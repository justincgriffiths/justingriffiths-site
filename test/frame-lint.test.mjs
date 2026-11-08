// The frame/skin boundary (site#62). src/frame.css sets layout only; pages compose its primitives and
// set no widths or breakpoints of their own. Pages not yet moved onto the frame are listed in LEGACY
// and shrink as they migrate (docs/responsive.md, "Migration debt").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const css = (p) => readFileSync(new URL(p, root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const decls = (text) => [...text.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)[;}]/gi)].map((m) => [m[1].toLowerCase(), m[2].trim()]);

const FRAMED = ["src/style.css", "content/qwen/page.css"];
const LEGACY = ["src/pedal-design.css", "content/marketing-101/page.css", "content/archive/page.css"];
const WIDTHS = /^(width|min-width|max-width|inline-size|min-inline-size|max-inline-size|grid-template-columns)$/;

test("frame.css holds no color, font or shadow: it reads semantic names a skin defines", () => {
  const f = css("src/frame.css");
  assert.doesNotMatch(f, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  for (const [prop] of decls(f)) assert.doesNotMatch(prop, /^(color|background.*|border.*color|box-shadow|text-shadow|font-family|font-weight)$/, prop);
});

test("frame.css owns the breakpoints: 768 and 1024 only", () => {
  const widths = [...css("src/frame.css").matchAll(/@media[^{]*\((?:min|max)-width:\s*([\d.]+)px/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(widths)].sort(), ["1024", "768"]);
});

for (const f of FRAMED) {
  test(`${f} composes the frame: no breakpoints, no width of its own`, () => {
    const c = css(f);
    assert.doesNotMatch(c, /@media[^{]*\((?:min|max)-width/, `${f} sets its own breakpoint; use a primitive or a container query`);
    for (const [prop, value] of decls(c)) {
      if (!WIDTHS.test(prop)) continue;
      const bare = value.replace(/var\([^)]*\)/g, "").replace(/(?<![\d.])100%|\bauto\b|(?<![\d.])0(?![\d.])/g, "");
      assert.doesNotMatch(bare, /\d/, `${f}: ${prop}: ${value} (set a primitive's dial, e.g. --fit, --grid-min)`);
    }
  });
}

test("no 100vh for full-height: use svh or dvh (the Safari toolbar moves 100vh)", () => {
  for (const f of ["src/chrome.css", "src/frame.css", ...FRAMED, ...LEGACY]) assert.doesNotMatch(css(f), /\b100vh\b/, f);
});
