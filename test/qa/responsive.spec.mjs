// Responsive QA gate (site#62). `npm run qa` = build, then `npx playwright test --project=webkit`.
// 1. every page on every Apple device, portrait (and landscape for phones and iPads), with a screenshot
// 2. the 320..1920 buffer sweep, 16px steps plus each breakpoint ±1
// 3. 200% text size, and the Safari bottom toolbar (a shorter viewport)
// 4. the shared nav: skip link, current page marked, menu collapses below desktop
// QA_BASE_URL=https://... runs the same checks against a deployed site (see playwright.config.mjs).
import { test, expect } from "@playwright/test";
import { readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEVICES, PAGES, ROTATES, contextFor, sweepWidths } from "./matrix.mjs";
import { audit, failures } from "./audit.mjs";
import { open } from "./open.mjs";

const DATE = process.env.QA_DATE ?? new Date().toISOString().slice(0, 10);
const SHOTS = join("qa", DATE, process.env.QA_BASE_URL ? "remote" : "");
mkdirSync(SHOTS, { recursive: true });
const dev = (id) => DEVICES.find((d) => d.id === id);
const PHONE = dev("iphone-16");

// A page marked `report` is out of this card's hands: its failures are attached to the test and
// printed in the run, and do not fail it. Every other page fails on any finding.
function verdict(page, list, what) {
  if (page.report && list.length) {
    test.info().annotations.push({ type: "report-only", description: `${what}: ${page.report}\n${list.slice(0, 12).join("\n")}` });
    return;
  }
  expect(list, what).toEqual([]);
}

test("every built page is in the QA page list", async () => {
  test.skip(!!process.env.QA_BASE_URL, "local build only");
  const listed = new Set(PAGES.map((p) => p.path));
  const found = [];
  const walk = (dir, depth) => {
    for (const e of readdirSync(join("dist", dir), { withFileTypes: true })) {
      if (e.isDirectory() && depth < 2 && !(dir === "archive" && e.name !== "research")) walk(join(dir, e.name), depth + 1);
      else if (e.name === "index.html") found.push(`/${dir}/`.replace(/^\/\.\//, "/").replace(/\/+/g, "/"));
    }
  };
  walk(".", 0);
  expect(found.filter((p) => !listed.has(p)), "add new pages to PAGES in test/qa/matrix.mjs").toEqual([]);
});

for (const page of PAGES) {
  for (const d of DEVICES) {
    for (const landscape of ROTATES(d) ? [false, true] : [false]) {
      const [w, h] = landscape ? [d.h, d.w] : [d.w, d.h];
      test(`${page.id} @ ${d.id} ${landscape ? "landscape" : "portrait"} ${w}x${h}`, async ({ browser }) => {
        const ctx = await browser.newContext(contextFor(d, landscape));
        const p = await ctx.newPage();
        await open(p, page.path);
        const r = await audit(p, { tap: w < 1024 });
        if (!landscape) await p.screenshot({ path: join(SHOTS, `${page.id}-${d.id}.png`), fullPage: true });
        await ctx.close();
        verdict(page, failures(r), `${page.path} at ${w}px`);
      });
    }
  }

  test(`${page.id} buffer sweep 320..1920`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...contextFor(PHONE), hasTouch: false, isMobile: false });
    const p = await ctx.newPage();
    await open(p, page.path);
    const bad = [];
    for (const w of sweepWidths()) {
      await p.setViewportSize({ width: w, height: 900 });
      const r = await audit(p, { tap: w < 1024 });
      for (const f of failures(r)) bad.push(`${w}px  ${f}`);
    }
    await ctx.close();
    verdict(page, bad, `${page.path} buffer sweep`);
  });

  test(`${page.id} 200% text on iPhone 16`, async ({ browser }) => {
    const ctx = await browser.newContext(contextFor(PHONE));
    const p = await ctx.newPage();
    await open(p, page.path);
    // Text-only zoom: tokens are px, so root font-size will not scale them. Double every computed size.
    await p.evaluate(() => {
      const els = [...document.querySelectorAll("body, body *")].filter((e) => !e.closest("svg"));
      const sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
      els.forEach((e, i) => (e.style.fontSize = `${sizes[i] * 2}px`));
    });
    const r = await audit(p, { tap: true });
    await ctx.close();
    verdict(page, failures(r), `${page.path} at 200% text`);
  });

  test(`${page.id} with the Safari toolbar (iPhone 16, 659px tall)`, async ({ browser }) => {
    const ctx = await browser.newContext({ ...contextFor(PHONE), viewport: { width: 393, height: 659 } });
    const p = await ctx.newPage();
    await open(p, page.path);
    const r = await audit(p, { tap: true });
    await ctx.close();
    verdict(page, failures(r), `${page.path} with toolbar`);
  });

  test(`${page.id} shared nav`, async ({ browser }) => {
    test.skip(page.nav === false, "not a page on the site chrome");
    // Phone: a skip link that lands on real content, the menu folded, the menu button opens it.
    const ctx = await browser.newContext(contextFor(PHONE));
    const p = await ctx.newPage();
    await open(p, page.path);
    const skip = p.locator("a.skip").first();
    await expect(skip, "every page has a skip link").toHaveCount(1);
    const target = (await skip.getAttribute("href")).slice(1);
    await expect(p.locator(`#${target}`), "skip link target exists").toHaveCount(1);
    expect(await p.evaluate(() => document.querySelector("a[href]").classList.contains("skip")), "skip link is first in tab order").toBe(true);
    const toggle = p.locator(".nav-toggle");
    await expect(toggle).toBeVisible();
    await expect(p.locator(".site-nav a").first(), "menu folded below desktop").toBeHidden();
    await toggle.click();
    await expect(p.locator(".site-nav a").first()).toBeVisible();
    if (page.nav !== false) await expect(p.locator(".site-nav [aria-current=page]").first(), "current page marked").toHaveCount(1);
    await ctx.close();
    // Desktop: the links sit in a row and the toggle is gone.
    const dctx = await browser.newContext(contextFor(dev("desktop")));
    const dp = await dctx.newPage();
    await open(dp, page.path);
    await expect(dp.locator(".nav-toggle")).toBeHidden();
    await expect(dp.locator(".site-nav a").first()).toBeVisible();
    await dctx.close();
  });
}
