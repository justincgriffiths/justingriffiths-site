// site#119: the truth-matrix section and the History section (every run counted, cost est.) fit at 390 and 1440 with no horizontal scroll.
// Shots land in $CLAUDE_JOB_DIR/tmp when set.
import { test, expect } from "@playwright/test";

const out = (n) => (process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/${n}.png` : `${n}.png`);

async function check(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/qwen/");
  await page.addStyleTag({ content: ".site-header, header { position: static !important; }" });   // the sticky bar would cross an element shot
  const truth = page.locator("#truth");
  await expect(truth.locator("svg").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await truth.locator("svg rect").count()).toBeGreaterThanOrEqual(4);
  expect(await truth.locator(".truth-line").count()).toBe(4);
  const det = truth.locator("details.truth-rows");
  expect(await det.evaluate((d) => d.open)).toBe(false);
  console.log(`truth section height at ${w}: ${Math.round((await truth.boundingBox()).height)}px`);
  await truth.screenshot({ path: out(`truth-${w}`) });
  await det.locator("summary").click();
  const box = truth.locator(".truth-scroll");
  expect(await box.evaluate((e) => e.scrollHeight > e.clientHeight || e.clientHeight <= 18 * 16)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await truth.screenshot({ path: out(`truth-open-${w}`) });
  await page.locator("#history").screenshot({ path: out(`history-all-${w}`) });
}

test("truth matrix at 390", async ({ page }) => { await check(page, 390, 844); });
test("truth matrix at 1440", async ({ page }) => { await check(page, 1440, 900); });
