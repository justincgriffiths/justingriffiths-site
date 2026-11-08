// site#107: the cost combo chart (calls stacked by job, dollars per run as a line on a right axis) fits at 390px and no two
// text labels in it overlap. Shots land in $CLAUDE_JOB_DIR/tmp when set.
import { test, expect } from "@playwright/test";

const out = (n) => (process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/${n}.png` : `${n}.png`);

async function check(page, name) {
  await page.goto("/qwen/");
  const sec = page.locator("#cost");
  await expect(sec.locator("svg").first()).toBeVisible();
  const r = await sec.evaluate((el) => {
    const svg = el.querySelector("svg"), sr = svg.getBoundingClientRect();
    const boxes = [...svg.querySelectorAll("text")].map((t) => { const b = t.getBoundingClientRect(); return { s: t.textContent, l: b.left, r: b.right, t: b.top, b: b.bottom }; });
    const hit = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) hit.push(`${a.s} / ${b.s}`);
    }
    const over = [...el.querySelectorAll("svg, .legend")].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length;
    return { hit, over, labels: boxes.length, outside: boxes.filter((b) => b.l < sr.left - 1 || b.r > sr.right + 1).map((b) => b.s) };
  });
  expect(r.hit).toEqual([]);
  expect(r.over).toBe(0);
  expect(r.outside).toEqual([]);
  await sec.screenshot({ path: out(name) });
}

test("cost combo at 390", async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await check(page, "cost-390"); });
test("cost combo at 1440", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); await check(page, "cost-1440"); });
