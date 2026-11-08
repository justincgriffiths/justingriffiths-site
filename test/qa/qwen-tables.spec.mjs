// site#92: at 390px in WebKit the Latency and Accuracy tables keep every word whole (no mid-word break) and fit the width.
import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 15"], viewport: { width: 390, height: 844 } });

for (const name of ["latency", "accuracy"]) {
  test(`${name} table labels stay whole at 390px`, async ({ page }) => {
    await page.goto("/qwen/");
    const sec = page.locator(`#${name}`);
    const table = sec.locator("table");
    await expect(table).toBeVisible();
    // A word that wraps mid-word spans two line boxes; a whole word is one rect. Checks every visible cell, plus the data-label text.
    const broken = await table.evaluate((t) => {
      const out = [];
      const check = (text, node) => {
        for (const m of text.matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
          if (r.getClientRects().length > 1) out.push(m[0]);
        }
      };
      for (const cell of t.querySelectorAll("th, td")) {
        if (cell.closest("thead")) continue;
        const w = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) check(n.data, n);
        const lab = cell.dataset.label;
        if (lab) {
          const probe = document.createElement("span");
          probe.textContent = lab; probe.style.cssText = "position:absolute;visibility:hidden;white-space:normal;width:" + cell.clientWidth * 0.5 + "px";
          cell.appendChild(probe);
          check(lab, probe.firstChild);
          probe.remove();
        }
      }
      return out;
    });
    expect(broken).toEqual([]);
    expect(await table.evaluate((t) => t.scrollWidth <= t.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await sec.screenshot({ path: process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp/${name}-390.png` : `${name}-390.png` });
  });
}
