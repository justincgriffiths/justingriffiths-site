// site#82: /resume/ lists every full title from LinkedIn verbatim (one entry per role, grouped by company),
// and the homepage links to it below the Positions facts.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const dist = (p) => new URL(`../dist/${p}`, import.meta.url);
before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));
const text = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'");

// [company, title, dates] exactly as the issue's table gives them.
const ROLES = [
  ["Pearmill", "Senior Director, Agency Enablement", "Mar 2026 – Present"],
  ["Pedal Performance", "General Manager", "Nov 2025 – Present"],
  ["TONE Exclusive", "Senior Director, Ecommerce", "Jan 2025 – Dec 2025"],
  ["Ophelia", "Senior Director, Growth", "Jan 2023 – Sep 2024"],
  ["Ophelia", "Director of Growth", "Aug 2021 – Mar 2023"],
  ["Nuts.com", "Director of Marketing", "Sep 2020 – Sep 2021"],
  ["Nuts.com", "Head of Marketing, Retention", "Aug 2019 – Sep 2020"],
  ["Nuts.com", "Senior Manager, Special Operations", "Apr 2019 – Aug 2019"],
  ["Phillips Pet Food & Supplies", "Senior Manager, Strategic Analytics", "Jul 2018 – Apr 2019"],
  ["PHIDO (a Phillips company)", "Product Manager, Data & BI", "Feb 2017 – Apr 2019"],
  ["PetFlow (acquired by Phillips, Feb 2017)", "Senior Business Analyst", "Sep 2016 – Sep 2017"],
];

test("/resume/ lists every title, company and date from the table", () => {
  const html = text(readFileSync(dist("resume/index.html"), "utf8"));
  for (const [company, title, dates] of ROLES) {
    assert.ok(html.includes(`<h3>${company}</h3>`), company);
    assert.ok(html.includes(`<h4 class="role-title">${title}</h4>`), title);
    assert.ok(html.includes(`<p class="role-dates">${dates}</p>`), `${title}: ${dates}`);
  }
  assert.equal((html.match(/class="role-title"/g) ?? []).length, ROLES.length + 1); // + the Oberlin degree
});

test("/resume/ carries the two LinkedIn descriptions and both schools", () => {
  const html = text(readFileSync(dist("resume/index.html"), "utf8"));
  assert.match(html, /approximately 200 employees responsible for \$800MM in revenue/);
  assert.match(html, /Nutshell CRM workflows for sales, customer-support, and inside-sales processes\./);
  assert.match(html, /B\.A\. with High Honors in English, English Literature/);
  assert.match(html, /Varsity Men's Soccer \(Captain 2012\)/);
  assert.match(html, /<h3>Regis High School<\/h3>/);
  assert.match(html, /Varsity Men's Soccer \(Captain 2008\)/);
});

test("the homepage links to /resume/ below the Positions facts", () => {
  const html = readFileSync(dist("index.html"), "utf8");
  const link = html.indexOf('class="cover-more" href="/resume/"');
  assert.ok(link > html.indexOf("<dt>Positions</dt>") && html.includes("<dt>Positions</dt>"), "link follows the Positions facts");
  assert.match(html, /<a class="cover-more" href="\/resume\/">Full resume/);
});

test("the nav lists Resume and marks it current on /resume/", () => {
  const html = readFileSync(dist("resume/index.html"), "utf8");
  assert.match(html, /<a href="\/resume\/" aria-current="page">Resume<\/a>/);
});
