// Disclosure: a collapsible section on native <details>/<summary>. No JS, keyboard and screen-reader
// friendly. Styles live in src/chrome.css (.disclosure). Documented in docs/disclosure.md.
// `summaryExtra` is trusted HTML shown under the title in the summary row, so it stays visible while collapsed.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function disclosure({ id, title, open = false, summaryExtra = "", body }) {
  return `<details class="disclosure" id="${esc(id)}"${open ? " open" : ""}><summary><span class="disclosure-head"><span class="disclosure-title">${esc(title)}</span>${summaryExtra ? `<span class="disclosure-extra">${summaryExtra}</span>` : ""}</span><span class="disclosure-mark" aria-hidden="true"></span></summary><div class="disclosure-body">${body}</div></details>`;
}

// A quiet text link: no fill, no box. For "Learn more" style endings.
export const quietLink = (href, text) => `<a class="quiet-link" href="${esc(href)}">${esc(text)}</a>`;
