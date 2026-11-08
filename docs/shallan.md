# Shallan

Shallan is Justin Griffiths's own design system. It is named for the Stormlight Lightweaver: a theme is an illusion laid over the same pages.

It started on 2026-11-08 (site#60) as a fork of the Pedal DS night lane that `/marketing-101/` used that day. From here it changes on its own, separate from Pedal.

| | |
|---|---|
| Source of truth | `src/shallan.css`, with its own `:root`. Every value in it is a literal copy. It never reads `src/tokens.css`. |
| Read by | every personal page: `/`, `/qwen/`, `/marketing-101/`, `/archive/`, `/fleet/`. `build.mjs` ships it with `src/chrome.css` as `/site.css`. |
| Not read by | `/pedal-design/`, which stays on the Pedal DS (`src/tokens.css`, shipped as `/pedal-design/site.css`). |
| Claude Design | project "Shallan" `7814dd55-035c-46e2-ab6d-b26afc0e1161`. Preview cards are `design/shallan/*.card.html`. Each has an `@dsCard` marker on its first line and links `design/shallan/shallan.css`, which every build copies from `src/shallan.css`. Push the folder with DesignSync after merge. |
| Tests | `test/shallan.test.mjs`, `test/site-theme.test.mjs` |

## How it differs from the fork point

1. **Corners are a step smaller.** Pills don't change.

   | Shape | Marketing 101 (Pedal DS) | Shallan | Token |
   |---|---|---|---|
   | Box: cards, diagram and table frames, the Lab menu | 14px | **10px** | `--shallan-radius-box` |
   | Inner: art inside a box, table-head corners | 8px | **6px** | `--shallan-radius-inner` |
   | Pill: buttons, chips, the session index | 999px | 999px | `--shallan-radius-pill` |
   | Tick: checkboxes, legend swatches | 4px | 4px | `--shallan-radius-tick` |

2. **Sentences are serif and titles are sans.** Running text is Newsreader. Titles, labels, controls, nav and chart text are Google Sans. To put the whole site back to all-sans, change one line in `src/shallan.css`:

   ```css
   --shallan-sentence-face: var(--font-sans);   /* was var(--font-serif) */
   ```

## Tokens

| Group | Tokens |
|---|---|
| Ground | `--night-900` #12121F (the void and every shadow), `--night-800` #1A1A2E (the ground), `--night-700` #23233F (raised, hover), `--night-600` #3A3A52 (hairlines), `--night-400` #6E6E85, `--night-200` #C7C7D2 (muted text) |
| Paper | `--paper` #FAF8F4 (text, rules and box fill), `--sand` #F2EEE7 (box hover), `--line-soft` #E7E2DB (hairlines in a box) |
| Accent | `--teal-500` #5DA490 (the accent), `--teal-400` #79B9A7 (links on night), `--teal-700` #316858 (links on paper), `--teal-100` #DAEFE9 (art field), `--orange-500` #F4845F (the second accent) |
| Data and status | `--lavender`, `--yellow`, `--success`, `--warning`, `--danger`: charts and badges only |
| Type | `--font-sans` Google Sans, `--font-serif` Newsreader, `--font-mono`; sizes `--text-display-xl` 64 to `--text-overline` 12; weights 400, 500 and 700 |
| Space | `--space-1` 4px to `--space-24` 96px on a 4px base |
| Rules and shadows | `--border-width` 2px, `--border-width-thick` 3px; `--shadow-hard-night-sm/-/-lg` 2, 4 and 6px offsets into night-900 |
| Texture | `--night-grid-line` (paper at 5%), `--night-grid-size` 64px |
| Page aliases | `--site-*`. `src/chrome.css` and the page stylesheets read only these and the scales above. |

## Night-lane rules

- The ground is night-800 with the 64px paper lattice at 5%. It is the only texture.
- Anything that sits directly on the ground takes a **paper** rule. An ink rule disappears on night.
- Hard shadows offset into **night-900**, never into ink.
- A box stays light: a paper fill, a 3px night-900 rule, the 10px box corner, and a 6px offset shadow.
- Muted text on night is night-200. On paper it is night-600.
- Teal is the one accent for links, the primary button and the current page. Orange is the second accent; use it sparingly.

## Do and don't

| Do | Don't |
|---|---|
| Read tokens with `var(--…)` in page stylesheets | Put hex values or font names in a page stylesheet (the tests fail) |
| Change a value in `src/shallan.css` and let every page follow | Edit `src/tokens.css` to restyle a personal page; that file is Pedal's |
| Use `--site-radius-box`, `-inner`, `-control` or `-tick` | Write `border-radius: 12px` or use the Pedal sticker radii |
| Set sentences in `--site-prose-font` and titles in `--site-font` | Set a heading, button or label in the serif |
| Keep `/pedal-design/` on the Pedal DS | Load `/site.css` on `/pedal-design/` |
| Rebuild the preview cards' copy with `node build.mjs` | Hand-edit `design/shallan/shallan.css` |
