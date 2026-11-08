# Disclosure

The reusable collapsible section. Native `<details>`/`<summary>`: no JavaScript, keyboard and screen-reader friendly.

| | |
|---|---|
| Component | `disclosure()` and `quietLink()` in `src/disclosure.mjs` |
| Styles | `.disclosure*` and `.quiet-link` in `src/chrome.css` (tokens only, no hex) |
| First used by | `/qwen/` (site#68): Background (closed) and Data (open) |

```js
import { disclosure, quietLink } from "./src/disclosure.mjs";
disclosure({ id: "data", title: "Data", open: true, summaryExtra: "<span>as of …</span>", body: "<p>…</p>" });
quietLink("/#about", "Learn more");
```

- `id` and `title` are required; `title` is escaped. `open` defaults to false.
- `summaryExtra` is trusted HTML under the title in the summary row, so it stays visible while collapsed (the as-of time uses this).
- `body` is trusted HTML.
- The summary row is at least `--tap` (44px) tall; the chevron is CSS, so no icon assets.
- `quietLink` is text only (no fill), underlined, brighter on hover. Use it for quiet endings like "Learn more".
- Fonts and colors come from Shallan tokens; do not set them per use.
