// site#88 rework: at 390px in WebKit the per-job calls charts fit the width, with no sideways scroll.
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 15"], viewport: { width: 390, height: 844 } });

test("calls by day charts fit at 390px", async ({ page }) => {
  await page.goto("/qwen/");
  const sec = page.locator("#calls");
  await expect(sec.locator("table")).toHaveCount(0);
  await expect(sec.locator("svg").first()).toBeVisible();
  const over = await sec.evaluate((el) => [...el.querySelectorAll("svg, .legend, .callsjob")].filter((e) => e.getBoundingClientRect().right > 390.5).length);
  expect(over).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await sec.screenshot({ path: process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/calls-390.png` : "calls-390.png" });
});
