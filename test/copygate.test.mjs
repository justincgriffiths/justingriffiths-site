import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { extractBlocks, check, changedOnly, judge, judgeBrief, loadRules } from "../bin/copygate";

// The gate is anchored on this site's own approved copy (voice/samples.md), not on a generic voice.
// Three proof cases from #100: the raw Background that shipped, #99's revised text, and the CoS's first rewrite.
const root = new URL("../", import.meta.url).pathname;
const fixture = (n) => extractBlocks(readFileSync(join(root, "test/fixtures/copygate", n), "utf8"));
const ids = (blocks) => [...new Set(check(blocks).map((f) => f.id))].sort();

test("the old /qwen/ Background fails on lowercase i and the ellipsis", () => {
  const got = ids(fixture("old-background.html"));
  assert.ok(got.includes("V-001"), "lowercase i");
  assert.ok(got.includes("V-002"), "four dots");
});

test("#99's revised Background passes", () => {
  assert.deepEqual(check(fixture("background-99.html")), []);
});

test("the CoS's first rewrite fails on bold bullets, 'I do not' and the aside", () => {
  assert.deepEqual(ids(fixture("cos-first-rewrite.html")), ["V-004", "V-005", "V-007"]);
});

test("the voice samples themselves pass the rules", () => {
  const prose = readFileSync(join(root, "voice/samples.md"), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  assert.deepEqual(check(prose.map((text) => ({ text, html: text, page: "samples" }))), []);
});

test("every rule row parses and carries its why", () => {
  const rules = loadRules();
  assert.ok(rules.length >= 7);
  for (const r of rules) assert.ok(r.rule && r.why && ["text", "html"].includes(r.kind), r.id);
});

test("only changed copy is checked: an old bad line on an unchanged page does not fail", () => {
  const bad = { page: "/a/", text: "i hit session token limits", html: "<li>i hit session token limits" };
  const fresh = { page: "/a/", text: "i switch accounts", html: "<li>i switch accounts" };
  assert.deepEqual(changedOnly([bad, fresh], [bad]), [fresh]);
  assert.deepEqual(changedOnly([bad], []), [bad], "a new page is all changed");
});

test("the CLI exits 1 on a failing text file and 0 on a clean one", () => {
  const run = (f) => spawnSync("node", ["bin/copygate", "--text", f], { cwd: root, encoding: "utf8" });
  const dir = mkdtempSync(join(tmpdir(), "cg-"));
  writeFileSync(join(dir, "bad.txt"), "i hit session token limits\n");
  writeFileSync(join(dir, "ok.txt"), "I hit session token limits.\n");
  const bad = run(join(dir, "bad.txt"));
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /FAIL V-001/);
  assert.equal(run(join(dir, "ok.txt")).status, 0);
});

test("the built site passes: --all, with the waived existing lines in voice/known-fails.tsv", () => {
  // Same dist as bin/site-build.sh, /fleet/ pages included (#105: #102 tested without them and a /fleet/game/ line broke the deploy).
  // The node-built fleet pages only; the Rust ones (landing, bike-factory, seats, battle-school) need the wasm toolchain.
  for (const script of ["build.mjs", "build-fleet-meta.mjs", "build-fleet-flows.mjs", "build-fleet-game.mjs"]) {
    execFileSync("node", [script], { cwd: root, stdio: "ignore" });
  }
  // The /qwen/ Background is raw until #99 lands; every other page must be clean or waived.
  const r = spawnSync("node", ["bin/copygate", "--all"], { cwd: root, encoding: "utf8" });
  // Leave dist/ as build.mjs alone makes it: the changed-only run after this test builds its base that way, so stray fleet pages would read as new copy.
  for (const d of ["meta", "flows", "game"]) rmSync(join(root, "dist/fleet", d), { recursive: true, force: true });
  const left = r.stdout.split("\n").filter((l) => l.startsWith("FAIL") && !l.includes(": /qwen/:"));
  assert.deepEqual(left, []);
});

const stub = (reply) => {
  const f = join(mkdtempSync(join(tmpdir(), "cg-")), "gcopy.sh");
  writeFileSync(f, `#!/bin/sh\ncat > "$0.in"\nprintf '%s\\n' '${reply}'\n`);
  chmodSync(f, 0o755);
  return f;
};

test("the judge sends the samples and the changed copy, and reads the verdict", () => {
  const blocks = fixture("cos-first-rewrite.html");
  const gcopy = stub("VERDICT: no\n- I do not have a way: formal");
  const env = { ...process.env, COPYGATE_GCOPY: gcopy, CI: "" };
  const j = judge(blocks, { env });
  assert.equal(j.ok, false);
  assert.equal(j.verdict, "no");
  const sent = readFileSync(gcopy + ".in", "utf8");
  assert.match(sent, /I'm the GM of Pedal Performance/);
  assert.match(sent, /I do not have a way/);
  assert.equal(judge(blocks, { env: { ...env, COPYGATE_GCOPY: stub("VERDICT: yes") } }).ok, true);
  assert.match(judgeBrief(blocks, "S"), /VERDICT: yes/);
});

test("the judge never runs in CI", () => {
  const j = judge(fixture("background-99.html"), { env: { ...process.env, CI: "true", COPYGATE_GCOPY: stub("VERDICT: yes") } });
  assert.equal(j.ok, false);
  assert.match(j.error, /local only/);
});

test("copygate is wired into npm test, CI qa and the deploy build", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts.test, /bin\/copygate/);
  assert.match(readFileSync(join(root, ".github/workflows/qa.yml"), "utf8"), /fetch-depth: 0[\s\S]*npm test/);
  assert.match(readFileSync(join(root, "bin/site-build.sh"), "utf8"), /copygate --all/);
});
