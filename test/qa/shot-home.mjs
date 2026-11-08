import { webkit, devices } from "@playwright/test";
const out = process.argv[2];
const b = await webkit.launch();
const cases = [
  ["390", { ...devices["iPhone 15"], viewport: { width: 390, height: 844 } }],
  ["1440", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
];
for (const [n, opts] of cases) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto("http://127.0.0.1:4173/", { waitUntil: "load" });
  await p.screenshot({ path: `${out}/home-${n}-top.png` });
  await p.screenshot({ path: `${out}/home-${n}-full.png`, fullPage: true });
  console.log(n, await p.evaluate(() => ({ w: innerWidth, sw: document.documentElement.scrollWidth, book: (document.body.innerText.match(/Book a call/g) || []).length, cta: document.querySelector(".header-cta")?.textContent, brand: document.querySelector(".brand")?.textContent, bg: getComputedStyle(document.querySelector(".header-cta")).backgroundColor })));
  await ctx.close();
}
await b.close();
