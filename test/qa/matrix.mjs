// The Apple device matrix (8 rows in the issue, 10 here: both iPad minis and a second Mac row, per Justin 2026-11-08), pages and buffer widths for the responsive QA (site#62). Documented in docs/responsive.md.
// Sizes are CSS px, portrait, the full screen (Playwright's own iPhone descriptors subtract Safari's toolbar).
// Apple's spec pages give pixels and scale; CSS px = pixels / scale. `base` is the Playwright descriptor that
// supplies the user agent, touch and pixel ratio.
import { devices } from "@playwright/test";

export const DEVICES = [
  { id: "iphone-se", name: "iPhone SE (3rd gen)", w: 375, h: 667, base: "iPhone SE (3rd gen)" },
  { id: "iphone-16", name: "iPhone 16 / 15", w: 393, h: 852, base: "iPhone 16" },
  { id: "iphone-16-pro-max", name: "iPhone 16 Pro Max", w: 440, h: 956, base: "iPhone 16 Pro Max" },
  { id: "ipad-mini", name: "iPad mini (A17 Pro, 8.3-inch)", w: 744, h: 1133, base: "iPad (gen 11)", dsf: 2 },
  { id: "ipad-mini-85", name: "iPad mini (8.5-inch)", w: 756, h: 1158, base: "iPad (gen 11)", dsf: 2 },
  { id: "ipad-air-11", name: "iPad Air 11-inch / iPad", w: 820, h: 1180, base: "iPad (gen 11)", dsf: 2 },
  { id: "ipad-pro-13", name: "iPad Pro 13-inch", w: 1032, h: 1376, base: "iPad Pro 11", dsf: 2 },
  { id: "macbook-air-13", name: "MacBook Air 13-inch (default scaled)", w: 1470, h: 956, base: "Desktop Safari", dsf: 2 },
  { id: "macbook-air-13-small", name: "MacBook Air 13-inch (native 2x)", w: 1280, h: 832, base: "Desktop Safari", dsf: 2 },
  { id: "desktop", name: "Desktop", w: 1920, h: 1080, base: "Desktop Safari", dsf: 1 },
];

// Phones and iPads also run landscape; the Mac and the desktop do not rotate.
export const ROTATES = (d) => d.base.startsWith("iP");

// Contexts for a device: Playwright's descriptor with our viewport, optionally rotated.
export function contextFor(d, landscape = false) {
  const base = devices[d.base];
  const [w, h] = landscape ? [d.h, d.w] : [d.w, d.h];
  return { ...base, viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: d.dsf ?? base.deviceScaleFactor };
}

// Every page on the site, built into dist/. A new top-level page in dist/ fails the coverage test until it is listed.
// framed: the page is composed from the frame primitives (src/frame.css), so the cross-skin geometry check applies.
// report: set = the page is out of this card's hands; its failures are printed and attached, and cannot fail the run.
export const PAGES = [
  { id: "home", path: "/", framed: true },
  { id: "qwen", path: "/qwen/", framed: true },
  { id: "marketing-101", path: "/marketing-101/" },
  { id: "archive", path: "/archive/" },
  { id: "archive-research", path: "/archive/research/", nav: false, report: "a stripped Tailwind snapshot of justingriffiths.info: no site chrome, no skip link, small taps; re-take it onto the site chrome (bin/archive-snap.mjs)" },
  { id: "pedal-design", path: "/pedal-design/", report: "the Pedal DS hub, out of bounds for #62: its own CSS (src/pedal-design.css) sets the faults listed" },
];

// Breakpoints (Pedal DS, src/tokens.css §4): 768 tablet, 1024 desktop. The sweep adds each ±1px.
export const BREAKPOINTS = [768, 1024];
export const sweepWidths = () => {
  const w = new Set();
  for (let x = 320; x <= 1920; x += 16) w.add(x);
  for (const b of BREAKPOINTS) [b - 1, b, b + 1].forEach((x) => w.add(x));
  return [...w].sort((a, b) => a - b);
};
