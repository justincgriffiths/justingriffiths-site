// The Tabler Qwen dashboard (/qwen/dashboard/): every number comes from a data row, a missing value is a marked
// "No data" and never a zero, nothing loads from a CDN, and the writeups leave Recommendation unwritten.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { renderDashboard, renderWriteup, fill, mdToHtml, parseWriteup, hbars, columns, ms, usd, pct } from "../src/qwen-dashboard-render.mjs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const data = JSON.parse(read("content/qwen/data.json")), tests = JSON.parse(read("content/qwen/tests.json"));
const dir = new URL("content/qwen/writeups/", root);
const writeups = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => ({ slug: f.slice(0, -3), ...parseWriteup(readFileSync(new URL(f, dir), "utf8")).meta }));

test("a missing value is a marked No data chip, never a zero", () => {
  for (const out of [ms(null), ms(undefined), usd(null)]) assert.match(out, /No data/);
  assert.match(hbars([{ label: "x", value: null }]), /No data/);
  assert.doesNotMatch(columns([{ label: "a", value: null }]), /height="0\.0"[^>]*>\s*<title>a: [^<]*0/);
  assert.equal(pct(1, 0), null);
});

test("the dashboard renders every card from the data files", () => {
  const html = renderDashboard(data, tests, writeups);
  for (const want of [data.model, String(data.accuracy.shadow_agreement_pct.triage), `${tests.triage_shadow.agree} of ${tests.triage_shadow.total}`, ms(data.latency_ms.qwen.p50)]) assert.ok(html.includes(want), want);
  for (const w of writeups) assert.ok(html.includes(`href="writeups/${w.slug}/"`), w.slug);
  assert.equal((html.match(/<svg/g) || []).length >= 6, true);
});

test("nothing loads from a CDN or another host", () => {
  const all = renderDashboard(data, tests, writeups) + read("build-qwen-dashboard.mjs");
  assert.doesNotMatch(all.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ""), /(src|href)="https?:\/\//);
  const build = read("build-qwen-dashboard.mjs");
  assert.match(build, /BASE = "\/qwen\/dashboard\/"/);
  assert.match(build, /href="\$\{BASE\}vendor\/tabler\.min\.css"/);
  assert.match(build, /src="\$\{BASE\}vendor\/tabler\.min\.js"/);
});

test("no hex colors or font names in the dashboard's own files", () => {
  for (const f of ["content/qwen/dashboard.css", "src/qwen-dashboard-render.mjs", "build-qwen-dashboard.mjs"]) assert.doesNotMatch(read(f), /#[0-9a-fA-F]{3,8}\b(?![\w-])/, f);
});

test("tests.json passes the Qwen privacy gate: counts only", () => {
  const r = spawnSync("python3", ["-I", new URL("bin/qwen-leakcheck.py", root).pathname], { input: read("content/qwen/tests.json"), encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("writeup placeholders fill from the data, and an unknown one stops the build", () => {
  assert.equal(fill("{{tests.triage_shadow.total}}", data, tests), String(tests.triage_shadow.total));
  assert.equal(fill("{{pct:tests.triage_shadow.agree/tests.triage_shadow.total}}", data, tests), String(pct(tests.triage_shadow.agree, tests.triage_shadow.total)));
  assert.throws(() => fill("{{tests.nope}}", data, tests), /no value/);
  assert.throws(() => fill("{{table:nope}}", data, tests), /unknown table/);
});

test("every writeup fills, renders, and leaves Recommendation unwritten", () => {
  assert.ok(writeups.length >= 3);
  for (const w of writeups) {
    const { meta, body } = parseWriteup(read(`content/qwen/writeups/${w.slug}.md`));
    assert.match(body, /## Recommendation\n\nNot written yet\.\n*$/, `${w.slug}: the Recommendation section is not blank`);
    const html = renderWriteup(meta, mdToHtml(fill(body, data, tests)), data, tests);
    assert.doesNotMatch(html, /\{\{/, w.slug);
    assert.match(html, /<h2>Recommendation<\/h2>\s*<p>Not written yet\.<\/p>/, w.slug);
  }
});
