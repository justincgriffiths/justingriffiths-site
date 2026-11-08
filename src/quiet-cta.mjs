// Quiet CTA: the one action a personal page offers, as a text link with a hairline underline.
// No fill, no box, no shadow. Styles live in src/chrome.css (.quiet-cta). Documented in docs/quiet-cta.md.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// `external` adds rel="noopener" (links that leave the site). `cls` adds modifier classes.
export const quietCta = (href, label, { cls = "", external = false } = {}) =>
  `<a class="quiet-cta${cls ? ` ${cls}` : ""}" href="${esc(href)}"${external ? ' rel="noopener"' : ""}>${esc(label)}</a>`;
