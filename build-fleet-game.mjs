// Builds the gated /fleet/game/ page: dist/fleet/game/index.html, the per-round report of the Qwen cost game.
// The fixture (fleet/game-fixture.json, fake rows only: this repo is public) is baked in so a preview renders;
// in production the page fetches /fleet/game/state.json (KV key "game/state.json", written by bin/game-kv.sh from
// bin/game-export.py) and redraws. The page is under /fleet/, so the Worker's Access check gates it.
// Rendering lives in gameKit(), which the build and the in-page script both run, so they cannot drift.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromeHead, siteHeader, NAV_SCRIPT } from "./src/chrome.mjs";
import { disclosure, quietLink } from "./src/disclosure.mjs";

const escText = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Self-contained on purpose (no module scope): its source is inlined into the page. `disclosure` and `esc` come in as arguments.
export function gameKit(disclosure, esc) {
  const SERIES = ["var(--site-series-1)", "var(--site-series-2)", "var(--site-series-4)", "var(--site-series-5)", "var(--site-series-3)"];
  const W = 560, H = 190, P = { l: 36, r: 12, t: 12, b: 28 };
  const when = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
  };
  const clock = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
  };
  const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
  const usd = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toFixed(2);

  // Small markdown subset for rules.md and learnings.md: headings, bullets, pipe tables, **bold**, `code`, paragraphs.
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const md = (src) => {
    const out = [], lines = String(src || "").split("\n");
    for (let i = 0; i < lines.length; ) {
      const l = lines[i];
      let m;
      if (!l.trim()) { i++; continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const n = Math.min(m[1].length + 2, 5); out.push(`<h${n}>${inline(m[2])}</h${n}>`); i++; continue; }
      if (/^\s*[-*]\s+/.test(l)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\s*[-*]\s+/, ""))}</li>`);
        out.push(`<ul>${items.join("")}</ul>`); continue;
      }
      if (/^\s*\|/.test(l)) {
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        const body = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === "-" ));
        const head = body.shift() || [];
        out.push(`<div class="table-scroll"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
    return out.join("");
  };

  const evidence = (e) => (/^https?:\/\//.test(e || "") ? `<a href="${esc(e)}" rel="noopener">link</a>` : esc(e || ""));

  // Points per round per agent: grouped columns, oldest round on the left.
  const chart = (rounds, agents) => {
    const rs = rounds.slice().reverse();
    const vals = rs.map((r) => agents.map((a) => r.events.filter((e) => e.agent === a).reduce((s, e) => s + e.points, 0)));
    const hi = Math.max(1, ...vals.flat()), lo = Math.min(0, ...vals.flat());
    const y = (v) => P.t + (H - P.t - P.b) * (1 - (v - lo) / (hi - lo));
    const step = (W - P.l - P.r) / rs.length, bw = Math.max(4, Math.min(22, step / (agents.length + 1)));
    const grid = [hi, 0, lo].filter((v, i, a) => a.indexOf(v) === i).map((v) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
    const bars = rs.map((r, i) => {
      const x0 = P.l + i * step + (step - bw * agents.length) / 2;
      const cols = agents.map((a, j) => {
        const v = vals[i][j];
        if (!v) return "";
        return `<rect x="${x0 + j * bw}" y="${Math.min(y(v), y(0))}" width="${bw - 2}" height="${Math.abs(y(v) - y(0))}" style="fill:${SERIES[j % SERIES.length]}"><title>Round ${r.round}, ${esc(a)}: ${signed(v)}</title></rect>`;
      }).join("");
      return cols + `<text x="${P.l + i * step + step / 2}" y="${H - 10}" text-anchor="middle">R${r.round}</text>`;
    }).join("");
    const legend = `<p class="legend">${agents.map((a, j) => `<span><i style="background:${SERIES[j % SERIES.length]}"></i>${esc(a)}</span>`).join("")}</p>`;
    return legend + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Points per round by agent">${grid}${bars}</svg>`;
  };

  const roundBlock = (r, i) => {
    const pts = r.events.reduce((s, e) => s + e.points, 0), spend = r.events.reduce((s, e) => s + e.usd, 0);
    const window_ = r.start ? `${when(r.start)} to ${clock(r.end)}` : "window not recorded";
    const byAgent = [...new Set(r.events.map((e) => e.agent))].map((a) => {
      const ev = r.events.filter((e) => e.agent === a);
      return `<h4>${esc(a)} <span class="sum">${signed(ev.reduce((s, e) => s + e.points, 0))} points</span></h4><div class="table-scroll"><table><thead><tr><th>Event</th><th>Points</th><th>USD</th><th>Evidence</th><th>Lesson</th></tr></thead><tbody>${ev.map((e) => `<tr><td>${esc(e.event)}</td><td>${signed(e.points)}</td><td>${usd(e.usd)}</td><td>${evidence(e.evidence)}</td><td>${esc(e.lesson || "")}</td></tr>`).join("")}</tbody></table></div>`;
    }).join("");
    return disclosure({
      id: `round-${r.round}`, title: `Round ${r.round}`, open: i === 0,
      summaryExtra: `<span>${esc(window_)} · ${signed(pts)} points · ${r.events.length} ${r.events.length === 1 ? "event" : "events"} · ${usd(spend)}${r.rules ? ` · rules ${esc(r.rules)}` : ""}</span>`,
      body: byAgent || `<p class="empty">No scoring events in this round.</p>`,
    });
  };

  const render = (doc) => {
    const rounds = doc.rounds || [], agents = Object.keys(doc.totals || {});
    const totals = agents.length
      ? `<div class="table-scroll"><table><thead><tr><th>Agent</th><th>Running total</th></tr></thead><tbody>${agents.map((a) => `<tr><td>${esc(a)}</td><td>${signed(doc.totals[a])}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="empty">No points scored yet.</p>`;
    return `<section id="totals"><h2>Running totals</h2><p class="why">Points each agent holds across every round so far.</p>${totals}${rounds.length && agents.length ? `<h3>Points per round</h3>${chart(rounds, agents)}` : ""}</section>
<section id="rounds"><h2>Rounds</h2><p class="why">Newest first. Each event is one row: what happened, the points, the dollars, the evidence and the lesson.</p>${rounds.length ? rounds.map(roundBlock).join("") : `<p class="empty">No rounds yet.</p>`}</section>
<section id="lessons"><h2>Lessons</h2>${doc.learnings_md ? `<div class="md">${md(doc.learnings_md)}</div>` : `<p class="empty">No lessons recorded yet.</p>`}</section>
${disclosure({ id: "scoring", title: "How scoring works", body: doc.rules_md ? `<div class="md">${md(doc.rules_md)}</div>` : `<p class="empty">Rules not available.</p>` })}`;
  };
  return { render, md };
}

const CSS = `.game .md h3,.game .md h4,.game .md h5{font-size:var(--text-body);margin:var(--space-4) 0 var(--space-1);text-transform:none;letter-spacing:0;color:var(--site-text)}
.game .md p,.game .md li{font-size:var(--text-body-sm);max-width:var(--measure);margin-block:var(--space-1)}
.game .md ul{padding-left:var(--space-5)}
.game h4{font-size:var(--text-body);margin:var(--space-5) 0 var(--space-1)}.game h4 .sum{color:var(--site-text-soft);font-weight:var(--weight-medium);font-size:var(--text-body-sm)}
.game td:last-child{min-width:12rem}@media(max-width:599.98px){.game th,.game td{padding-inline:var(--space-2);overflow-wrap:anywhere}.game td:last-child{min-width:7rem}}.game .disclosure{margin-top:var(--space-2)}.game #rounds .disclosure-title{font-size:var(--text-body-lg)}`;

export const kit = (esc = escText) => gameKit(disclosure, esc);

export function page(doc) {
  const { render } = kit();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Qwen game · Justin Griffiths</title>
${chromeHead()}
<style>${readFileSync(new URL("./content/qwen/page.css", import.meta.url), "utf8")}
${CSS}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
${siteHeader("game")}
<main id="main" class="wrap qwen game">
<h1>Qwen game</h1>
<p class="why"><span id="stamp">${escText(doc.masked ? "Fixture data, fake rows. " : "")}Generated ${escText(doc.generated_at)}.</span></p>
<div id="game-root">${render(doc)}</div>
<p class="learn-more">${quietLink("/qwen/", "Back to the Qwen rollout")}</p>
<script>
const esc=${escText.toString()};
${disclosure.toString()}
const kit=(${gameKit.toString()})(disclosure,esc);
fetch("/fleet/game/state.json",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d||!Array.isArray(d.rounds))return;
  document.getElementById("game-root").innerHTML=kit.render(d);
  document.getElementById("stamp").textContent=(d.masked?"Fixture data, fake rows. ":"")+"Generated "+d.generated_at+".";
}).catch(()=>{});
</script></main>
${NAV_SCRIPT}
</body></html>
`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = JSON.parse(readFileSync(new URL("./fleet/game-fixture.json", import.meta.url), "utf8"));
  mkdirSync("dist/fleet/game", { recursive: true });
  writeFileSync("dist/fleet/game/index.html", page(doc));
  console.log("dist/fleet/game/index.html");
}
