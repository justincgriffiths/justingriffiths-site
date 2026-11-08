// The in-page audit for the responsive QA (site#62). `audit(page, { tap })` runs inside the page and returns
// what broke: horizontal scroll, text clipped past the viewport or by overflow, text overlapping text, and
// tap targets under 44px. Inline links inside a sentence are exempt from the tap rule (WCAG 2.5.8 allows them).

export const TAP_MIN = 44;

export async function audit(page, { tap = true } = {}) {
  return page.evaluate(({ tap, TAP_MIN }) => {
    const vw = window.innerWidth;
    const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""} "${(el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
    // Visually hidden on purpose (sr-only, a 1px clipped box) is not on screen, so it cannot clip or overlap.
    const shown = (el) => {
      if (!el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }) || el.closest(".sr-only, .skip:not(:focus)")) return false;
      const r = el.getBoundingClientRect();
      return !(r.width <= 1 && r.height <= 1);
    };
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll") return true;
      }
      return false;
    };
    const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    // One rect per line of text, so a link that wraps is not judged by the box around all its lines.
    const lineRects = (el) => {
      const r = document.createRange();
      const out = [];
      for (const n of ownText(el)) {
        r.selectNodeContents(n);
        for (const q of r.getClientRects()) if (q.width >= 1 && q.height >= 1) out.push({ left: q.left, top: q.top, right: q.right, bottom: q.bottom });
      }
      return out;
    };
    const textRect = (el) => {
      const rs = lineRects(el);
      return rs.length ? { left: Math.min(...rs.map((q) => q.left)), right: Math.max(...rs.map((q) => q.right)) } : null;
    };

    const out = { hscroll: null, clipped: [], overlap: [], tap: [] };
    if (document.documentElement.scrollWidth > vw) out.hscroll = `scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${vw}`;

    const texty = [...document.body.querySelectorAll("*")].filter((el) => ownText(el).length && shown(el) && !el.closest("svg, script, style, noscript, [aria-hidden=true]"));

    for (const el of texty) {
      if (inScroller(el)) continue;
      const t = textRect(el);
      if (t && (t.right > vw + 1 || t.left < -1)) out.clipped.push(`${label(el)} spans ${Math.round(t.left)}..${Math.round(t.right)} of ${vw}`);
      const o = getComputedStyle(el).overflowX;
      if ((o === "hidden" || o === "clip") && el.scrollWidth > el.clientWidth + 1) out.clipped.push(`${label(el)} clipped by overflow (${el.scrollWidth} > ${el.clientWidth})`);
    }

    const boxes = texty
      .filter((el) => !inScroller(el) && !el.closest("[hidden]"))
      .map((el) => ({ el, t: lineRects(el), pos: getComputedStyle(el).position }))
      .filter((b) => b.t.length && b.pos !== "fixed" && b.pos !== "sticky" && !b.el.closest(".site-header"));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        for (const p of a.t)
          for (const q of b.t) {
            const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
            const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
            if (w > 2 && h > 3) out.overlap.push(`${label(a.el)} over ${label(b.el)} (${Math.round(w)}x${Math.round(h)}px)`);
          }
      }

    if (tap) {
      for (const el of document.body.querySelectorAll("a[href], button, summary, input:not([type=hidden]), select, textarea, [role=button]")) {
        if (!shown(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "inline" && el.tagName === "A") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.height < TAP_MIN - 0.5 || r.width < TAP_MIN - 0.5) out.tap.push(`${label(el)} is ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  }, { tap, TAP_MIN });
}

export const failures = (r) => [
  ...(r.hscroll ? [`hscroll: ${r.hscroll}`] : []),
  ...r.clipped.map((x) => `clipped: ${x}`),
  ...r.overlap.map((x) => `overlap: ${x}`),
  ...r.tap.map((x) => `tap: ${x}`),
];
