// Renders dist/marketing-101/index.html: the Marketing 101 lesson, one page, ten sessions.
// Copy: content/marketing-101/rewrite/*.md (ChatGPT's second-person rewrite of src/*.md).
// Diagrams: content/marketing-101/diagrams/*.svg (rendered once by bin/render-diagrams.mjs).
// Look: the Pedal Design System night lane, tokens vendored from pearmill/pedal origin/main
// creative/Pedal-Design-System/tokens (2026-11-04). No dependencies.
import { chromeHead, siteHeader, bookButton, NAV_SCRIPT } from "./src/chrome.mjs";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const ROOT = new URL("./content/marketing-101/", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Embed caption (as the doc exported it) -> diagram file.
const DIAGRAMS = {
  "the 8 sessions": "path", "demand curve": "demand", "marketing jobs": "jobs", "the funnel": "funnel",
  "attention as a two-sided market": "attention", "moments of truth": "moments", "CPA driver tree": "cpa",
  "paid to earned to shared to paid": "peso", "Sinek's Golden Circle": "golden", "Apple": "apple",
  "Nike revenue": "nike", "club plan canvas": "club", "thesis lenses": "thesis",
};
const diagram = (caption) => {
  const key = Object.keys(DIAGRAMS).find((k) => caption.startsWith(k));
  if (!key) throw new Error(`no diagram for embed "${caption}"`);
  return `<figure class="box dia">${read(`diagrams/${DIAGRAMS[key]}.svg`).trim()}</figure>`;
};

// Inline markdown: escapes, code-free. Links, bold, italic, \[ \] escapes.
const inline = (s) => esc(s.replace(/\\([[\]*_])/g, "$1"))
  .replace(/\[([^\]]+)\]\(&lt;([^)]+?)&gt;\)|\[([^\]]+)\]\(([^)\s]+(?:\([^)]*\))?[^)\s]*)\)/g, (_, t1, u1, t2, u2) =>
    `<a href="${u1 ?? u2}" rel="noopener">${t1 ?? t2}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

const cells = (row) => row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

function render(md, { sessionHeading }) {
  const lines = md.replace(/\r/g, "").split("\n");
  let html = "", i = 0, title = "", lead = "";
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^# (.*)/))) { title = m[1]; i++; continue; }
    if ((m = l.match(/^&#91;embedded content: (.*?)\\?\]\s*$/))) { html += diagram(m[1]); i++; continue; }
    if ((m = l.match(/^(#{2,3}) (.*)/))) { html += `<h3>${inline(m[2])}</h3>`; i++; continue; }
    if (l.startsWith("|")) {
      const rows = []; while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const [head, , ...body] = rows.map(cells);
      html += `<div class="box table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
        body.map((r) => `<tr>${r.map((c, j) => { const t = j === 0 && !head[0] ? "th" : "td"; const n = /^[\d–-]+$/.test(c) ? ' class="n"' : ""; return `<${t}${n}>${inline(c)}</${t}>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const ordered = /^\d+\. /.test(l), items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^(- |\d+\. )/, ""));
      const task = items.every((x) => x.startsWith("[ ] "));
      const links = !ordered && items.every((x) => /^\[[^\]]+\]\([^)]+\)$/.test(x));
      const tag = ordered ? "ol" : "ul";
      html += `<${tag}${task ? ' class="tasks"' : links ? ' class="watch"' : ""}>${items.map((x) => `<li>${task ? '<span class="tick" aria-hidden="true"></span>' : ""}${inline(x.replace(/^\[ \] /, ""))}</li>`).join("")}</${tag}>`;
      continue;
    }
    if (l.startsWith("> ")) { html += `<blockquote>${inline(l.slice(2))}</blockquote>`; i++; continue; }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#|\||- |\d+\. |> |&#91;)/.test(lines[i])) para.push(lines[i++]);
    const text = para.join(" ");
    if ((m = text.match(/^\*\*Answers?:\*\*\s*(.*)/))) {
      html += `<details class="answer"><summary>Show the answer</summary><p>${inline(m[1])}</p></details>`;
    } else if (!lead && sessionHeading && text.startsWith("**Big question:**")) {
      lead = text; html += `<p class="big">${inline(text)}</p>`;
    } else html += `<p>${inline(text)}</p>`;
  }
  return { title, html };
}

const files = readdirSync(new URL("rewrite/", ROOT)).filter((f) => f.endsWith(".md")).sort();
const [startFile, ...sessionFiles] = files;
const start = render(read(`rewrite/${startFile}`), { sessionHeading: false });
const sessions = sessionFiles.map((f, n) => {
  const r = render(read(`rewrite/${f}`), { sessionHeading: true });
  const name = r.title.replace(/^\d+\s*·\s*/, "");
  return { n: n + 1, name, html: r.html };
});
const short = ["Demand curve", "Jobs map", "Funnel", "Attention", "Moments", "Counting", "Paid vs earned", "Start with why", "Club plan", "Thesis"];

const css = readFileSync(new URL("page.css", ROOT), "utf8");
const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marketing 101 · Justin Griffiths</title>
  <meta name="description" content="Ten short sessions on marketing, read as an economist.">
  <meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  ${chromeHead()}
  <style>${css}</style>
</head>
<body>
  <a class="skip" href="#s1">Skip to session 1</a>
  ${siteHeader("marketing-101")}
  <header id="top" class="hero wrap">
    <p class="eyebrow">Ten talk-through sessions</p>
    <h1>Marketing 101</h1>
    ${start.html}
  </header>
  <nav class="sessions" aria-label="Sessions"><div class="wrap">${sessions.map((s) => `<a href="#s${s.n}"><span>${s.n}</span>${esc(short[s.n - 1])}</a>`).join("")}</div></nav>
  <main>${sessions.map((s) => `
    <section id="s${s.n}" class="session wrap">
      <p class="eyebrow">Session ${s.n}</p>
      <h2>${inline(s.name)}</h2>
      ${s.html}
      <p class="next">${s.n < sessions.length ? `<a href="#s${s.n + 1}">Next: ${esc(short[s.n])} →</a>` : `<a href="#top">Back to the top ↑</a>`}</p>
    </section>`).join("")}
  </main>
  <footer class="site-footer"><div class="wrap"><p>Built by <a href="/">Justin Griffiths</a>. Every case study links its sources in its session.</p>${bookButton("btn-sm")}</div></footer>
  ${NAV_SCRIPT}
</body>
</html>
`;
mkdirSync(new URL("./dist/marketing-101/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/marketing-101/index.html", import.meta.url), page);
console.log(`marketing-101: ${sessions.length} sessions, ${page.length} bytes`);
