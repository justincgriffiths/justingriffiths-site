import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Every word a visitor sees is written to the visitor. A build note from an agent to an agent,
// or to Justin ("Illustration slot for Justin: set dossier.cover.visual in bio.json to replace
// the mark", live on the hub until 2026-11-08), fails the build. Visible text plus alt and
// aria-label, which screen readers speak. dist/archive/ is the frozen .info copy and is skipped.
const root = new URL("../", import.meta.url).pathname;
const AGENT_NOTES = [
  [/\bslot for\b/i, "a slot handed to someone to fill"],
  [/\bfor Justin\b/i, "a note addressed to Justin"],
  [/\b(set|edit|change|update)\b[^.]{0,40}\bin [\w./-]+\.(json|ya?ml|md|mjs|js|toml)\b/i, "an instruction to edit a source file"],
  // Any source file named in reader text is a build note ("Set from bio.json, the same text I use on every
  // profile", live on the hub until 2026-11-08, slipped past the line above).
  [/\b[\w-]+\.(json|ya?ml|mjs|toml)\b/i, "a source file named in page text"],
  [/\b[a-z_]+\.[a-z_]+\.[a-z_]+\b/, "a dotted config key"],
  [/\bto replace the (mark|placeholder|image|copy)\b/i, "a replace-me instruction"],
  [/\b(TODO|FIXME|TBD|XXX)\b/, "a work marker"],
  [/\bpending approval\b/i, "an approval note"],
  [/\bReady for Agent\b|\bagent:/i, "fleet routing text"],
];

const pages = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return n === "archive" ? [] : pages(p);
  return n.endsWith(".html") ? [p] : [];
});
const readerText = (html) => [
  ...html.replace(/<(script|style|code|pre)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").split(/\s{2,}|\n/),
  ...[...html.matchAll(/\b(?:alt|aria-label)="([^"]*)"/g)].map((m) => m[1]),
].map((s) => s.replace(/&[a-z#0-9]+;/gi, " ").trim()).filter(Boolean);

before(() => execFileSync("node", ["build.mjs"], { cwd: root, stdio: "ignore" }));

test("no page carries copy written to an agent or to Justin", () => {
  const hits = [];
  for (const p of pages(join(root, "dist")))
    for (const line of readerText(readFileSync(p, "utf8")))
      for (const [re, what] of AGENT_NOTES)
        if (re.test(line)) hits.push(`${p.slice(root.length)}: ${what}: "${line.slice(0, 120)}"`);
  assert.deepEqual(hits, []);
});

test("the guard catches the 2026-11-08 hub note", () => {
  const line = "Illustration slot for Justin: set dossier.cover.visual in bio.json to replace the mark.";
  assert.ok(AGENT_NOTES.filter(([re]) => re.test(line)).length >= 3);
});
