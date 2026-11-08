// site#88 send-back: at 390px in WebKit the Calls by day table must show every model column, with no sideways scroll.
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 15"], viewport: { width: 390, height: 844 } });

test("calls by day fits at 390px with every model column visible", async ({ page }) => {
  await page.goto("/qwen/");
  const t = page.locator("details.calls table");
  await expect(t).toBeVisible();
  const m = await t.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, wrap: el.parentElement.scrollWidth - el.parentElement.clientWidth }));
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.wrap).toBeLessThanOrEqual(0);
  const heads = (await t.locator("thead th").evaluateAll((els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().right <= 390 + 0.5).map((e) => e.textContent.trim())));
  expect(heads).toEqual(["Job", "Calls", "Qwen", "Haiku"]);
  expect(await t.locator("tbody td.narrow").first().innerText()).toMatch(/^\d+ \(\d+ fb · \d+ cap · \d+ shadow\)$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await t.screenshot({ path: process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/calls-390.png` : "calls-390.png" });
});
