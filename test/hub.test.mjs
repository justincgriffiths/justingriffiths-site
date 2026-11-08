import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

execFileSync("node", ["build.mjs"], { cwd: new URL("../", import.meta.url), stdio: "ignore" });
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

test("nav has a Lab anchor between Work and the influences section", () => {
  const start = html.indexOf('<nav class="index');
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

test("the booking link is plain text in About and the footer only (#53, #67)", () => {
  const book = /<a class="quiet-cta" href="https:\/\/cal\.com\/justin-griffiths" rel="noopener">Book a call<\/a>/;
  const about = html.slice(html.indexOf('id="about"'), html.indexOf('id="work"'));
  assert.match(about, book);
  assert.match(html.slice(html.indexOf("<footer")), book);
  assert.equal((html.match(/>Book a call</g) ?? []).length, 2);
  const section = html.slice(html.indexOf('id="contact"'), html.indexOf("</main>"));
  assert.doesNotMatch(section, /Book a call/);
});

test("About section is built from bio.json only (#67)", () => {
  const about = html.slice(html.indexOf('id="about"'), html.indexOf('id="work"'));
  assert.match(about, /<h2 class="section-title" id="about-title"><span class="num">01<\/span>About<\/h2>/);
  const long = JSON.parse(readFileSync(new URL("../bio.json", import.meta.url), "utf8")).bio.long;
  assert.ok(about.includes(long.replace(/&/g, "&amp;").replace(/'/g, "&#39;")), "About is not bio.long");
});

test(".info link points at /archive/", () => {
  assert.ok(!html.includes("justingriffiths.info"));
  assert.match(html, /href="\/archive\/"/);
});

test("no placeholder logo tiles render (site#51)", () => {
  assert.doesNotMatch(html, /Logo pending|logo-ph/i);
});

test("the hero has no JG logo, no filled button and no Book a call (#67)", () => {
  const hero = html.slice(html.indexOf('<section class="cover"'), html.indexOf('<nav class="index'));
  assert.doesNotMatch(hero, /class="mark|JG monogram|visual-card|class="btn/);
  assert.doesNotMatch(hero, /Book a call/);
  assert.doesNotMatch(html, /class="brand"[^>]*>\s*<svg|class="mark/);
});
