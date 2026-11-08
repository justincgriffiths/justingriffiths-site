// One contact sheet per page: every device screenshot from qa/<date>/ side by side, to the same scale
// (CSS px x 0.25), tops aligned, cropped at 1100px tall. Run after `npm run qa`:
//   node bin/contact-sheet.mjs [date]   -> qa/<date>/contact-<page>.png   (log: bin/contact-sheet.log)
import { webkit } from "@playwright/test";
import { readdirSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEVICES, PAGES } from "../test/qa/matrix.mjs";

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const dir = resolve("qa", date);
const K = 0.25, MAXH = 1100;
const have = new Set(readdirSync(dir));
let rc = 0;
const browser = await webkit.launch();
try {
  for (const pg of PAGES) {
    const cells = DEVICES.filter((d) => have.has(`${pg.id}-${d.id}.png`));
    if (!cells.length) continue;
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:16px;background:#1a1a2e;color:#f8f7f4;font:12px/1.3 system-ui,sans-serif}
      h1{font-size:14px;margin:0 0 12px}.row{display:flex;gap:16px;align-items:flex-start}
      figure{margin:0}figcaption{margin-bottom:6px;white-space:nowrap}
      .shot{overflow:hidden;max-height:${MAXH}px;outline:1px solid #888}.shot img{display:block}</style>
      <h1>${pg.path} · WebKit · ${date}</h1><div class="row">${cells
        .map((d) => `<figure><figcaption><b>${d.name}</b><br>${d.w}×${d.h}</figcaption><div class="shot" style="width:${Math.round(d.w * K)}px"><img src="${pg.id}-${d.id}.png" width="${Math.round(d.w * K)}"></div></figure>`)
        .join("")}</div>`;
    const htmlPath = join(dir, `.contact-${pg.id}.html`);
    writeFileSync(htmlPath, html);
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto(`file://${htmlPath}`);
    await page.waitForLoadState("load");
    await page.screenshot({ path: join(dir, `contact-${pg.id}.png`), fullPage: true });
    await page.close();
  }
} catch (e) {
  rc = 1;
  console.error(e);
} finally {
  await browser.close();
  mkdirSync("bin", { recursive: true });
  appendFileSync("bin/contact-sheet.log", `[${new Date().toISOString()}] argv=[${date}] exit=${rc}\n`);
  process.exitCode = rc;
}
