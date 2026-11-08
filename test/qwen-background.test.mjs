import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Background is the copy-revision pass (issue #99), not Justin's raw message.
const src = readFileSync(new URL("../build-qwen.mjs", import.meta.url), "utf8");
const m = src.match(/title: "Background", body: `([\s\S]*?)` \}\)\}/);
const EXPECTED = `<p class="why">Coding with agents is expensive. At Pedal, we use Claude for almost everything, and managing cost without interrupting my work has been a constant challenge. I hit session token limits and weekly and monthly spend caps, and I switch models, accounts and credit cards to avoid running out during important work.</p>
<p class="why">This week, I analyzed my usage and found that much of my budget goes to work that is not client-facing and barely involves coding: cleanup, QA, reminders and documentation. Almost all of it is rote and repeated.</p>
<p class="why">I designed a game for my agents to encourage them to use free, open source models instead of relying solely on Anthropic's cheaper models.</p>
<p class="why">Two chores moved from paid Claude calls to a free model running on my own machine (qwen3-coder:30b): sorting my inboxes and labeling GitHub issues. This page shows aggregates only: counts, dollars and milliseconds, never a message, sender or issue.</p>`;

test("Background renders the revised copy exactly", () => {
  assert.ok(m, "Background disclosure found");
  assert.equal(m[1], EXPECTED);
});

test("Background has no lowercase standalone i, no '....', no list", () => {
  const text = m[1].replace(/<[^>]*>/g, "");
  assert.doesNotMatch(text, /(^|[^A-Za-z'])i([^A-Za-z']|$)/);
  assert.ok(!text.includes("...."));
  assert.doesNotMatch(m[1], /<(ul|ol|li)\b/);
});
