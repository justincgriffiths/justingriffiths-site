// site#97: on every History chart the marker label ("Qwen live") sits clear of the bars and of every other label.
// Shots land in $CLAUDE_JOB_DIR/tmp when set.
import { test, expect } from "@playwright/test";

const out = (n) => (process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/${n}.png` : `${n}.png`);

async function check(page, name) {
  await page.goto("/qwen/");
  const sec = page.locator("#history");
  await expect(sec.locator("svg").first()).toBeVisible();
  const r = await sec.evaluate((el) => {
    const hit = [], bad = [];
    let marked = 0;
    for (const svg of el.querySelectorAll("svg")) {
      const sr = svg.getBoundingClientRect();
      const texts = [...svg.querySelectorAll("text")].map((t) => ({ s: t.textContent, b: t.getBoundingClientRect() }));
      const bars = [...svg.querySelectorAll("rect:not(.gridline)")].map((x) => x.getBoundingClientRect()).filter((b) => b.height > 1.5);
      const x = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) if (x(texts[i].b, texts[j].b)) hit.push(`${texts[i].s} / ${texts[j].s}`);
        if (texts[i].b.left < sr.left - 1 || texts[i].b.right > sr.right + 1 || texts[i].b.top < sr.top - 1) bad.push(texts[i].s);
        if (texts[i].s === "Qwen live") { marked++; if (bars.some((b) => x(texts[i].b, b))) bad.push("Qwen live over a bar"); }
      }
    }
    return { hit, bad, marked };
  });
  expect(r.hit).toEqual([]);
  expect(r.bad).toEqual([]);
  expect(r.marked).toBeGreaterThan(0);
  await sec.screenshot({ path: out(name) });
}

test("history marker at 390", async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await check(page, "history-390"); });
test("history marker at 1440", async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); await check(page, "history-1440"); });
