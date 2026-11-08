import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { parseFlow, listPage, flowPage, MERMAID } from "../build-fleet-flows.mjs";

const ok = "%% title: T <x>\n%% owner: ●X\n%% source-of-truth-for: things\nflowchart TD\n  a-->b\n";

test("parseFlow reads the header", () => {
  const f = parseFlow("my-flow", ok);
  assert.deepEqual([f.title, f.owner, f.truth], ["T <x>", "●X", "things"]);
});
test("parseFlow rejects a missing header field, a bad slug, and no diagram", () => {
  assert.throws(() => parseFlow("a", ok.replace("%% owner: ●X\n", "")), /owner/);
  assert.throws(() => parseFlow("Bad_Slug", ok), /slug/);
  assert.throws(() => parseFlow("a", ok.replace("flowchart TD\n  a-->b\n", "hello")), /no diagram/);
});
test("pages escape the source, link the list, and pin mermaid with SRI", () => {
  const f = parseFlow("my-flow", ok);
  assert.match(listPage([f]), /href="\/fleet\/flows\/my-flow\/">T &lt;x&gt;/);
  const p = flowPage(f);
  assert.match(p, /class="mermaid">%% title: T &lt;x&gt;/);
  assert.match(MERMAID.src, /mermaid@\d+\.\d+\.\d+\//);
  assert.ok(p.includes(`integrity="${MERMAID.integrity}"`));
});
test("every committed flow parses", () => {
  const dir = new URL("../content/flows/", import.meta.url);
  const names = readdirSync(dir).filter((n) => n.endsWith(".mmd"));
  assert.ok(names.includes("card-to-merge.mmd"));
  for (const n of names) parseFlow(n.slice(0, -4), readFileSync(new URL(n, dir), "utf8"));
});
