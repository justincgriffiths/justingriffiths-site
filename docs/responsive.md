# Responsive QA and the frame (site#62)

Every page on justingriffiths.com is checked in WebKit, Safari's engine, on the Apple devices people use, and at
every width between them. The layout comes from one frame (`src/frame.css`, `src/chrome.mjs`), not from page CSS.

**Run it:** `npm run qa` builds, then runs `npx playwright test --project=webkit`. Screenshots go to
`qa/<date>/<page>-<device>.png`; `node bin/contact-sheet.mjs` makes `qa/<date>/contact-<page>.png`.
Against a deployed site: `QA_BASE_URL=https://justingriffiths-site.jg-personal.workers.dev npx playwright test --project=webkit`
(screenshots land in `qa/<date>/remote/`). CI (`.github/workflows/qa.yml`) runs `npm test` and `npm run qa` on every PR.
Never take a phone shot with headless Chrome `--window-size`: it floors the viewport at 500px.

## Device matrix

CSS px, portrait. Phones and iPads also run landscape. Apple's spec pages give pixels and scale; CSS px = pixels / scale
(checked 2026-11-08 at apple.com/<device>/specs). `test/qa/matrix.mjs` holds the table.

| Device | CSS size | Source |
|---|---|---|
| iPhone SE (3rd gen) | 375 x 667 | 1334 x 750 at 2x |
| iPhone 16 / 15 | 393 x 852 | 2556 x 1179 at 3x |
| iPhone 16 Pro Max | 440 x 956 | 2868 x 1320 at 3x |
| iPad mini (A17 Pro, 8.3") | 744 x 1133 | 2266 x 1488 at 2x (the size in the issue) |
| iPad mini (8.5") | 756 x 1158 | 2316 x 1512 at 2x (Apple's mini page now lists this model) |
| iPad Air 11" / iPad 10.9" | 820 x 1180 | 2360 x 1640 at 2x |
| iPad Pro 13" | 1032 x 1376 | 2752 x 2064 at 2x |
| MacBook Air 13" default scaled | 1470 x 956 | macOS default "looks like" mode for the 2560 x 1664 panel. **Not in Apple's spec**, which lists only the panel; this is the viewport users get. |
| MacBook Air 13" native 2x | 1280 x 832 | 2560 x 1664 at 2x, the second desktop-small row |
| Desktop | 1920 x 1080 | a common monitor |

Both iPad minis and both Mac rows are Justin's call (2026-11-08, site#62). Playwright's own iPad descriptors do not match
Apple's sizes, so the matrix sets the viewport itself and borrows only user agent, touch and pixel ratio from a descriptor.

## What fails a page

| Check | Fails when |
|---|---|
| Horizontal scroll | `scrollWidth > innerWidth` |
| Clipped text | a line of text runs past the viewport edge, or `overflow: hidden` cuts it (scroll containers are exempt) |
| Overlapping text | two lines of text from different elements intersect |
| Tap targets | a button, summary or block link is under 44 x 44 below 1024px (links inside a sentence are exempt, WCAG 2.5.8) |
| Buffer sweep | any of the above at 320 to 1920 in 16px steps, and at 767, 768, 769, 1023, 1024, 1025 |
| 200% text | any of the above with every font size doubled (text-only zoom; the tokens are px, so root font size cannot do it) |
| Safari toolbar | any of the above on an iPhone 16 with a 659px-tall viewport; no full-height rule may use `100vh` (use `svh` or `dvh`; `test/frame-lint.test.mjs`) |
| Shared nav | a skip link first in tab order that lands on real content, the menu folded below 1024px and opened by its button, the current page marked, the links in a row from 1024px |
| Skin swap | the same page under a stub skin (`test/qa/fixtures/skin-stub.css`) keeps every frame box's left edge and width at every device width. Boxes bounded in `ch` (`--measure`, the lede) are let out of both runs: a line length is wider in a wider typeface by design. |
| Page list | a built page missing from `PAGES` in `test/qa/matrix.mjs` fails the run |

Pages marked `report` in the matrix (`/pedal-design/`, the `/archive/research/` snapshot) are not this card's to fix.
Their findings print in the run and attach to the test, and they cannot fail it.

## The frame

Two layers. The **skin** is color, type families, radii, shadows and texture (today `src/tokens.css` §4; `src/shallan.css`
when #60 lands it). The **frame** is how things lay out. The frame holds no color and no font; it reads size tokens and the
semantic `--site-*` names a skin defines. `test/frame-lint.test.mjs` enforces it. Breakpoints are the Pedal DS pair,
mobile-first: **768px** and **1024px**. Layout tokens (`--site-max`, `--site-gutter`, `--measure`, `--tap`, `--header-h`)
stay in `src/tokens.css` §4 for now, to leave #60's file alone; they move to `frame.css` on the rebase after #60.

Primitives (`src/frame.css`). Each takes its dials as custom properties on the element or its page rule:

| Class | What it does | Dials |
|---|---|---|
| `.center` | a column held to a width, with the site gutters (`.wrap` is the same) | `--center-max` |
| `.band` | full-bleed background, content in the Center column | none |
| `.stack` | children in a column, one gap | `--stack-gap` |
| `.cluster` | children in a row that wraps | `--cluster-gap`, `-align`, `-justify` |
| `.sidebar` | fixed side beside a main; stacks when main would get under half the row | `--sidebar-w`, `-gap`, `-min`; `.sidebar-sticky` pins the side from 1024px |
| `.switcher` | a row while each child gets `--switcher-at`, a stack below | `--switcher-at`, `-gap`, `-g1`, `-g2`, `-align` |
| `.grid` | as many columns of at least `--grid-min` as fit | `--grid-min`, `-gap`, `-fit` |
| `.cover-screen` | at least `--cover-min` of the screen tall, one child centered (`.cover-mid`) | `--cover-min` |
| `.fit` | no wider than `--fit` | `--fit` |
| `.tap`, `.tap-pull` | a 44 x 44 control, text kept in place | none |
| `.t-display`, `.t-title`, `.t-lede` | fluid type, `clamp()` between two scale steps | none |
| `.cq`, `.rows-item` | container query: label and value rows go side by side in a box 28rem wide | `--rows-label` |

Rules for page CSS on a framed page (`/` and `/qwen/` today): no `@media (min-width|max-width)`, no `width`, `max-width` or
`grid-template-columns` with a literal length. Set a dial instead, or use a container query.

## Add a page

1. Build it on the shared chrome: `chromeHead()`, a `.skip` link to `#main`, `siteHeader("<key>")`, `<main id="main">`, `NAV_SCRIPT`.
2. Compose the body from the primitives. Set dials, not widths.
3. Add the page to `PAGES` in `test/qa/matrix.mjs` (`framed: true` once it uses the primitives) and to `NAV` in `src/chrome.mjs`.
4. `npm run qa`. Fix findings in the page, not in the test.

## Migration debt

Not yet on the frame, and listed so they shrink: `/marketing-101/` (own `.wrap`, px widths, one 900px breakpoint),
`content/archive/page.css`, `src/pedal-design.css` (out of bounds for #62), and the 186 archive snapshot pages
(only `/archive/research/` is in the sweep). Layout tokens still in `tokens.css` (above). The Pedal night lane as a second
real skin replaces the stub fixture once `src/shallan.css` exists.
