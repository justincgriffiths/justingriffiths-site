// site#119: the truth-matrix section and the History section (every run counted, cost est.) fit at 390 and 1440 with no horizontal scroll.
// Shots land in $CLAUDE_JOB_DIR/tmp when set.
import { test, expect } from "@playwright/test";

const out = (n) => (process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/${n}.png` : `${n}.png`);

async function check(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/qwen/");
  await page.addStyleTag({ content: ".site-header, header { position: static !important; }" });   // the sticky bar would cross an element shot
  const truth = page.locator("#truth");
  await expect(truth.locator("table").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await truth.locator("h3").count()).toBeGreaterThanOrEqual(4);
  await truth.screenshot({ path: out(`truth-${w}`) });
  await page.locator("#history").screenshot({ path: out(`history-all-${w}`) });
}

test("truth matrix at 390", async ({ page }) => { await check(page, 390, 844); });
test("truth matrix at 1440", async ({ page }) => { await check(page, 1440, 900); });
