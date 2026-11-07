// Renders dist/qwen/index.html (and dist/qwen/data.json) from content/qwen/data.json, which
// bin/qwen-state.sh writes. Public page: aggregates only. Every chart is inline SVG drawn from the rows.
// A null accuracy value renders as a marked "pending" slot (mycroft#668, skill-library#560), never a zero.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("./content/qwen/data.json", import.meta.url), "utf8"));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const C = { answered: "#1b6b5a", fell_back: "#c27a1a", capped: "#8a93a0", qwen: "#1b6b5a", haiku: "#3a5fa8", sonnet: "#7a4fa0" };
const W = 560, H = 190, P = { l: 44, r: 12, t: 12, b: 28 };

const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;
const legend = (items) => `<p class="legend">${items.map(([k, c]) => `<span><i style="background:${c}"></i>${esc(k)}</span>`).join("")}</p>`;
const svg = (label, inner) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${inner}</svg>`;

function axisY(max, fmt = (v) => v) {
  return [0, 0.5, 1].map((f) => {
    const y = P.t + (H - P.t - P.b) * (1 - f);
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="grid"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(+(max * f).toFixed(2)))}</text>`;
  }).join("");
}

// Stacked daily columns: answered / fell back / capped, one per day.
function stacked(rows, label) {
  if (!rows.length) return empty("No live runs yet. Dry runs are not counted.");
  const keys = ["answered", "fell_back", "capped"];
  const max = Math.max(1, ...rows.map((r) => keys.reduce((s, k) => s + r[k], 0)));
  const bw = Math.min(40, (W - P.l - P.r) / rows.length - 6), step = (W - P.l - P.r) / rows.length;
  const bars = rows.map((r, i) => {
    let y = H - P.b; const x = P.l + i * step + (step - bw) / 2;
    const segs = keys.map((k) => { const h = (r[k] / max) * (H - P.t - P.b); y -= h; return h ? `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${C[k]}"><title>${esc(r.day)} ${k}: ${r[k]}</title></rect>` : ""; }).join("");
    return segs + `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">${esc(r.day.slice(5))}</text>`;
  }).join("");
  return legend([["answered by Qwen", C.answered], ["fell back to Claude", C.fell_back], ["capped (not offered to Qwen)", C.capped]]) + svg(label, axisY(max) + bars);
}

function horizontal(obj, label, color = C.qwen) {
  const e = Object.entries(obj), max = Math.max(1, ...e.map(([, v]) => v)), rh = 26;
  const bars = e.map(([k, v], i) => `<text x="0" y="${i * rh + 17}">${esc(k)}</text><rect x="110" y="${i * rh + 5}" width="${(v / max) * (W - 170)}" height="16" fill="${color}"/><text x="${116 + (v / max) * (W - 170)}" y="${i * rh + 17}">${v}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${e.length * rh + 4}" role="img" aria-label="${esc(label)}">${bars}</svg>`;
}

function costChart() {
  const rows = data.cost_per_run.triage_by_day;
  if (!rows.length) return empty("No cost rows yet.");
  const max = Math.max(...rows.map((r) => r.usd_per_run)) * 1.1, step = (W - P.l - P.r) / Math.max(rows.length - 1, 1);
  const x = (i) => P.l + (rows.length === 1 ? (W - P.l - P.r) / 2 : i * step), y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const line = rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.usd_per_run)}`).join("");
  const dots = rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.usd_per_run)}" r="3.5" fill="${r.qwen_era ? C.qwen : C.haiku}"><title>${esc(r.day)} $${r.usd_per_run} per run (${r.runs} runs)</title></circle>`).join("");
  const b = data.cost_per_run.triage_baseline_usd_per_run;
  const base = b == null ? "" : `<line x1="${P.l}" x2="${W - P.r}" y1="${y(b)}" y2="${y(b)}" stroke="${C.capped}" stroke-dasharray="4 3"/><text x="${P.l + 4}" y="${y(b) - 4}">pre-Qwen average $${b}</text>`;
  const ticks = rows.filter((_, i) => i % Math.ceil(rows.length / 8) === 0).map((r) => `<text x="${x(rows.indexOf(r))}" y="${H - 10}" text-anchor="middle">${esc(r.day.slice(5))}</text>`).join("");
  const it = data.cost_per_run.issue_tag_usd_per_item;
  const itNote = Object.keys(it).length ? `<p class="note">Issue-tag, dollars per issue: ${Object.entries(it).map(([m, v]) => `${esc(m)} $${v}`).join(", ")}.</p>` : "";
  return legend([["triage run, before Qwen", C.haiku], ["triage run, Qwen on", C.qwen]]) + svg("Triage dollars per run by day", axisY(max, (v) => `$${v}`) + base + `<path d="${line}" fill="none" stroke="#c9ced6"/>` + dots + ticks) + itNote;
}

function latency() {
  const q = data.latency_ms.qwen, h = data.latency_ms.haiku;
  const row = (name, v) => `<tr><th>${name}</th>${v ? `<td>${v.n}</td><td>${v.p50} ms</td><td>${v.p90} ms</td>` : `<td colspan="3" class="pending">Pending: no live items yet</td>`}</tr>`;
  return `<table><thead><tr><th></th><th>Items</th><th>Median</th><th>90th percentile</th></tr></thead><tbody>${row("Qwen", q.n ? q : null)}${row("Haiku", h)}</tbody></table>`;
}

function accuracy() {
  const a = data.accuracy, t = a.trial.correct_of_4;
  const bars = Object.entries(t).map(([m, v], i) => `<text x="0" y="${i * 26 + 17}">${esc(m)}</text><rect x="70" y="${i * 26 + 5}" width="${(v / 4) * 300}" height="16" fill="${C[m]}"/><text x="${76 + (v / 4) * 300}" y="${i * 26 + 17}">${v} of 4</text>`).join("");
  const slot = (title, obj, refs) => `<tr><th>${title}</th>${Object.entries(obj).map(([w, v]) => v == null ? `<td class="pending">${esc(w)}: pending (${esc(refs[w])})</td>` : `<td>${esc(w)}: ${esc(v)}%</td>`).join("")}</tr>`;
  return `<p class="note"><strong>${esc(a.trial.label)}.</strong> This is the test run before Qwen went live, not live accuracy.</p>
    <svg viewBox="0 0 ${W} 82" role="img" aria-label="Trial: correct answers out of 4 by model">${bars}</svg>
    <table><tbody>${slot("Shadow agreement", a.shadow_agreement_pct, a.pending.shadow_agreement_pct)}${slot("Correction-free", a.correction_free_pct, a.pending.correction_free_pct)}</tbody></table>`;
}

const section = (id, title, why, body) => `<section id="${id}"><h2>${esc(title)}</h2><p class="why">${esc(why)}</p>${body}</section>`;
const bd = data.breakdowns;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qwen rollout · Justin Griffiths</title>
<meta name="description" content="Aggregates from moving inbox triage and issue labels onto a free local model.">
<link rel="canonical" href="https://justingriffiths.com/qwen/"><meta name="color-scheme" content="light">
<style>
:root{--ink:#1d2330;--mute:#5c6573;--line:#dfe3e9;--bg:#fbfbf9}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:640px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.1rem;margin:0 0 2px}
section{border-top:1px solid var(--line);padding:22px 0}.why,.note,.legend{color:var(--mute);font-size:.9rem;margin:2px 0 10px}
.legend{display:flex;flex-wrap:wrap;gap:4px 14px}.legend i{display:inline-block;width:10px;height:10px;margin-right:5px}
svg{width:100%;height:auto;display:block}svg text{font:11px system-ui,sans-serif;fill:var(--mute)}.grid{stroke:var(--line)}
table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.pending,.empty{color:#8a5a00;background:#fff6e0;font-size:.85rem}.empty{padding:8px}a{color:#1b6b5a}
.cols{display:grid;gap:18px}@media(min-width:720px){main{max-width:760px}.cols{grid-template-columns:1fr 1fr}}
</style></head><body><main>
<h1>Qwen rollout</h1>
<p class="why">Two chores moved from paid Claude calls to a free model running on my own machine (qwen3-coder:30b): sorting my inboxes and labelling GitHub issues. Aggregates only: counts, dollars and milliseconds, never a message, sender or issue.</p>
${section("share", "Share on Qwen", "How much of the work Qwen took each day, and how much went back to Claude. This shows the ramp from 1 item to all.",
  `<div class="cols"><div><h3>Inbox triage</h3>${stacked(data.share_by_day.triage, "Triage items per day by who answered")}</div><div><h3>Issue labels</h3>${stacked(data.share_by_day["issue-tag"], "Issue-tag items per day by who answered")}</div></div>`)}
${section("fallbacks", "Fallback reasons", "Why Qwen's answer was thrown out and Claude did the item instead.", horizontal(data.fallback_reasons, "Fallbacks by reason", C.fell_back))}
${section("cost", "Cost per run", "Dollars per triage run over time, against the average before Qwen.", costChart())}
${section("latency", "Latency", "How long Qwen takes per item, next to Haiku.", latency())}
${section("accuracy", "Accuracy", "Whether the free model holds up. Live measures fill in as the checks land.", accuracy())}
${section("breakdowns", "Breakdowns", "The same counts cut three ways.",
  `<h3>By workflow</h3>${horizontal(Object.fromEntries(Object.entries(bd.by_workflow).map(([k, v]) => [k, v.answered])), "Items answered by Qwen, by workflow")}
   <h3>By tool call</h3>${horizontal(bd.by_tool_call, "Items by tool call")}
   <h3>By task label</h3>${horizontal(bd.by_task_label, "Triage items by label")}`)}
</main></body></html>
`;

mkdirSync(new URL("./dist/qwen/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/qwen/index.html", import.meta.url), html);
writeFileSync(new URL("./dist/qwen/data.json", import.meta.url), JSON.stringify(data));
console.log(`built dist/qwen/index.html (${html.length} bytes)`);
