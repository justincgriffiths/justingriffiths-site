import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

execFileSync("node", ["build.mjs"], { cwd: new URL("../", import.meta.url), stdio: "ignore" });
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

test("nav has a Lab anchor between Work and the influences section", () => {
  const start = html.indexOf('<nav class="index"');
  const nav = html.slice(start, html.indexOf("</nav>", start));
  assert.match(nav, /href="#lab"/);
  assert.ok(nav.indexOf("#work") < nav.indexOf("#lab") && nav.indexOf("#lab") < nav.indexOf("#influences"));
});

test("Lab section lists Qwen rollout and Fleet", () => {
  const lab = html.slice(html.indexOf('id="lab"'), html.indexOf('id="influences"'));
  assert.match(lab, /href="\/qwen\/"[^>]*>Qwen rollout/);
  assert.match(lab, /href="\/fleet\/"[^>]*>Fleet/);
  assert.match(lab, /Sign-in required/);
});

test("no mailto or personal email address on the hub (#53)", () => {
  assert.ok(!html.includes("mailto:"));
  assert.ok(!/@justingriffiths\.com/.test(html));
});

test("cover Contact and Contact section both point at the booking link (#53)", () => {
  const cover = html.slice(html.indexOf("Contact</dt>"), html.indexOf("Contact</dt>") + 200);
  assert.match(cover, /href="https:\/\/cal\.com\/justin-griffiths"/);
  const section = html.slice(html.indexOf('id="contact"'));
  assert.match(section, /Book a call<\/dt><dd><a href="https:\/\/cal\.com\/justin-griffiths"/);
});

test(".info link points at /archive/", () => {
  assert.ok(!html.includes("justingriffiths.info"));
  assert.match(html, /href="\/archive\/"/);
});

test("no placeholder logo tiles render (site#51)", () => {
  assert.doesNotMatch(html, /Logo pending|logo-ph/i);
});

test("the hero carries the Book a call button and a visual card", () => {
  const hero = html.slice(html.indexOf('<section class="cover"'), html.indexOf('<nav class="index"'));
  assert.match(hero, /<a class="btn btn-primary[^"]*" href="https:\/\/cal\.com\/justin-griffiths"[^>]*>Book a call<\/a>/);
  assert.match(hero, /class="visual-card"/);
});
