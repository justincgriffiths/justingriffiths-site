// The frame must not move when the skin does (site#62). Same page, same device width, two skins: the real one
// and test/qa/fixtures/skin-stub.css (different fonts, radii, shadows, colors). Every frame container keeps its
// left edge and width. Heights are not compared: a different typeface wraps text differently, and that is
// the skin's business, not the frame's.
// The shared header is also compared across pages, including /pedal-design/ (read-only): one header, one geometry.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEVICES, PAGES, contextFor } from "./matrix.mjs";
import { open } from "./open.mjs";

const STUB = readFileSync(new URL("./fixtures/skin-stub.css", import.meta.url), "utf8");
const FRAME = ".site-header-in, .nav-toggle, .band, .center, .wrap, .sidebar, .switcher, .grid, .cluster, .stack, .cover-screen";

const MEASURED = ".prose, .entries, .facts, .entry .note, .footer p, .site-footer p, .why, .note, .legend, .lede";

const geometry = (page) =>
  page.evaluate((sel) => {
    const rows = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || !el.checkVisibility()) continue;
      const path = [];
      for (let n = el; n && n !== document.body; n = n.parentElement) path.unshift(`${n.tagName.toLowerCase()}:${[...n.parentElement.children].indexOf(n)}`);
      rows.push(`${path.join(">")}  x=${Math.round(r.left)} w=${Math.round(r.width)}`);
    }
    return rows;
  }, FRAME);

for (const pg of PAGES.filter((p) => p.framed)) {
  for (const d of DEVICES) {
    test(`${pg.id} frame geometry, real skin vs stub skin @ ${d.id} ${d.w}px`, async ({ browser }) => {
      const ctx = await browser.newContext(contextFor(d));
      const p = await ctx.newPage();
      await open(p, pg.path);
      // Boxes bounded in ch (--measure 65ch, the 30ch lede) are a line length, so a wider typeface makes them wider by
      // design. They are let out of both runs; every other frame box is compared.
      await p.addStyleTag({ content: `${MEASURED} { max-inline-size: none !important; }` });
      const real = await geometry(p);
      await p.addStyleTag({ content: STUB });
      const stub = await geometry(p);
      await ctx.close();
      expect(real.length, "the page has frame boxes").toBeGreaterThan(0);
      expect(stub).toEqual(real);
    });
  }
}

for (const d of DEVICES) {
  test(`shared header geometry is the same on every page @ ${d.id} ${d.w}px`, async ({ browser }) => {
    const seen = {};
    for (const pg of PAGES.filter((p) => p.nav !== false)) {
      const ctx = await browser.newContext(contextFor(d));
      const p = await ctx.newPage();
      await open(p, pg.path);
      seen[pg.id] = await p.evaluate(() => {
        const box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`; };
        return { header: box(".site-header-in"), brand: box(".brand"), cta: box(".header-cta"), toggle: getComputedStyle(document.querySelector(".nav-toggle")).display };
      });
      await ctx.close();
    }
    const [first, ...rest] = Object.entries(seen);
    for (const [id, g] of rest) expect(g, `${id} header vs ${first[0]}`).toEqual(first[1]);
  });
}
