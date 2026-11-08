# Quiet CTA

The reusable action for personal pages: a text link with a hairline underline. No fill, no box, no shadow. It replaced the filled "Book a call" button (site#67).

| | |
|---|---|
| Component | `quietCta()` in `src/quiet-cta.mjs`; `bookLink()` in `src/chrome.mjs` wraps it for the booking URL |
| Styles | `.quiet-cta` and `.quiet-links` in `src/chrome.css` (tokens only, no hex, no font names) |
| Used by | Header ("About me" → `/#about`), About section and footer ("Book a call"), `/archive/` ("Open the research home") |
| Sibling | `quietLink()` in `src/disclosure.mjs`: softer, body font, for "Learn more" endings |

```js
import { quietCta } from "./src/quiet-cta.mjs";
quietCta("/#about", "About me", { cls: "header-cta" });
quietCta("https://cal.com/justin-griffiths", "Book a call", { external: true });
```

- `href` and `label` are required and escaped. `external` adds `rel="noopener"`. `cls` adds modifier classes.
- Heading face (Google Sans), small size, at least `--tap` (44px) tall. Underline brightens to the link color on hover.
- `bio.json` can place links in a section with `{ "type": "quiet-links", "from": "links", "only": ["Book a call"] }`.
- Rule it enforces: on a personal page "Book a call" appears at most twice (About and footer), and no `.btn` renders (`test/site-chrome.test.mjs`).
- Fonts and colors come from Shallan tokens; do not set them per use.
