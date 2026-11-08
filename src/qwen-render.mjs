// Renders the /qwen/ data section from the aggregates JSON. One source, two callers: build-qwen.mjs (server
// render, the no-JS fallback) and the page's own script, which inlines this file (minus `export`) and re-renders
// from /qwen/data.json every 5 minutes (site#78). Keep it free of Node APIs and imports: it runs in the browser.
let data;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Series colors are tokens (src/shallan.css --site-series-*), applied as style="fill:var(...)".
const C = { answered: "var(--site-series-1)", fell_back: "var(--site-series-2)", capped: "var(--site-series-3)", policy: "var(--site-series-5)", qwen: "var(--site-series-1)", haiku: "var(--site-series-4)", sonnet: "var(--site-series-5)" };
const W = 560, H = 190, P = { l: 44, r: 12, t: 12, b: 28 };

const empty = (msg) => `<p class="empty">${esc(msg)}</p>`;
const legend = (items) => `<p class="legend cluster">${items.map(([k, c]) => `<span><i style="background:${c}"></i>${esc(k)}</span>`).join("")}</p>`;
const svg = (label, inner) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${inner}</svg>`;

function axisY(max, fmt = (v) => v) {
  return [0, 0.5, 1].map((f) => {
    const y = P.t + (H - P.t - P.b) * (1 - f);
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="gridline"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(+(max * f).toFixed(2)))}</text>`;
  }).join("");
}

// Stacked daily columns: answered / fell back / capped, one per day.
function stacked(rows, label) {
  if (!rows.length) return empty("No live runs yet. Dry runs are not counted.");
  const hasPolicy = rows.some((r) => r.policy), keys = ["answered", "fell_back", "capped", ...(hasPolicy ? ["policy"] : [])];
  const max = Math.max(1, ...rows.map((r) => keys.reduce((s, k) => s + r[k], 0)));
  const bw = Math.min(40, (W - P.l - P.r) / rows.length - 6), step = (W - P.l - P.r) / rows.length;
  const bars = rows.map((r, i) => {
    let y = H - P.b; const x = P.l + i * step + (step - bw) / 2;
    const segs = keys.map((k) => { const h = (r[k] / max) * (H - P.t - P.b); y -= h; return h ? `<rect x="${x}" y="${y}" width="${bw}" height="${h}" style="fill:${C[k]}"><title>${esc(r.day)} ${k}: ${r[k]}</title></rect>` : ""; }).join("");
    return segs + `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">${esc(r.day.slice(5))}</text>`;
  }).join("");
  return legend([["answered by Qwen", C.answered], ["fell back to Claude", C.fell_back], ["capped (not offered to Qwen)", C.capped], ...(hasPolicy ? [["held back by rule", C.policy]] : [])]) + svg(label, axisY(max) + bars);
}

const WORKFLOW_NAMES = { "cron-triage": "Cron triage", declutter: "Declutter", "session-reap": "Session reap" };
// One block per job that uses Qwen (site#79): first logged, run count, totals, and a share-by-day chart. A job with no rows
// says so, never a 0%.
function workflowBlock(key, w) {
  const name = WORKFLOW_NAMES[key] || key;
  if (!w || !w.runs) return `<div><h3>${esc(name)}</h3>${empty("No runs logged.")}</div>`;
  const l = w.latency_ms, per = l.unit === "run" ? "per run" : "per item";
  const parts = [`first logged ${esc(w.first_logged)}`, `${w.runs} ${w.runs === 1 ? "run" : "runs"}`, `${w.answered} answered by Qwen`, `${w.fell_back} fell back to Claude`];
  if (w.capped) parts.push(`${w.capped} capped`);
  if (w.policy) parts.push(`${w.policy} held back by rule (${Object.entries(w.policy_reasons).map(([k, n]) => `${esc(k)} ${n}`).join(", ")})`);
  parts.push(`$${w.usd}`);
  if (l.n) parts.push(`median ${l.p50} ms, 90th percentile ${l.p90} ms ${per}`);
  return `<div><h3>${esc(name)}</h3><p class="note">${parts.join(" · ")}.</p>${stacked(w.share_by_day, `${name} items per day by who answered`)}</div>`;
}

function horizontal(obj, label, color = C.qwen) {
  const e = Object.entries(obj), max = Math.max(1, ...e.map(([, v]) => v)), rh = 26;
  const bars = e.map(([k, v], i) => `<text x="0" y="${i * rh + 17}">${esc(k)}</text><rect x="110" y="${i * rh + 5}" width="${(v / max) * (W - 170)}" height="16" style="fill:${color}"/><text x="${116 + (v / max) * (W - 170)}" y="${i * rh + 17}">${v}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${e.length * rh + 4}" role="img" aria-label="${esc(label)}">${bars}</svg>`;
}

function costChart() {
  const rows = data.cost_per_run.triage_by_day;
  if (!rows.length) return empty("No cost rows yet.");
  const max = Math.max(...rows.map((r) => r.usd_per_run)) * 1.1, step = (W - P.l - P.r) / Math.max(rows.length - 1, 1);
  const x = (i) => P.l + (rows.length === 1 ? (W - P.l - P.r) / 2 : i * step), y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const line = rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.usd_per_run)}`).join("");
  const dots = rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.usd_per_run)}" r="3.5" style="fill:${r.qwen_era ? C.qwen : C.haiku}"><title>${esc(r.day)} $${r.usd_per_run} per run (${r.runs} runs)</title></circle>`).join("");
  const b = data.cost_per_run.triage_baseline_usd_per_run;
  const base = b == null ? "" : `<line x1="${P.l}" x2="${W - P.r}" y1="${y(b)}" y2="${y(b)}" style="stroke:${C.capped}" stroke-dasharray="4 3"/><text x="${P.l + 4}" y="${y(b) - 4}">pre-Qwen average $${b}</text>`;
  const ticks = rows.filter((_, i) => i % Math.ceil(rows.length / 8) === 0).map((r) => `<text x="${x(rows.indexOf(r))}" y="${H - 10}" text-anchor="middle">${esc(r.day.slice(5))}</text>`).join("");
  const it = data.cost_per_run.issue_tag_usd_per_item;
  const itNote = Object.keys(it).length ? `<p class="note">Issue-tag, dollars per issue: ${Object.entries(it).map(([m, v]) => `${esc(m)} $${v}`).join(", ")}.</p>` : "";
  return legend([["triage run, before Qwen", C.haiku], ["triage run, Qwen on", C.qwen]]) + svg("Triage dollars per run by day", axisY(max, (v) => `$${v}`) + base + `<path d="${line}" fill="none" class="trend"/>` + dots + ticks) + itNote;
}

function latency() {
  const q = data.latency_ms.qwen, h = data.latency_ms.haiku;
  const row = (name, v) => `<tr><th>${name}</th>${v ? `<td>${v.n}</td><td>${v.p50} ms</td><td>${v.p90} ms</td>` : `<td colspan="3" class="pending">Pending: no live items yet</td>`}</tr>`;
  return `<table><thead><tr><th></th><th>Items</th><th>Median</th><th>90th percentile</th></tr></thead><tbody>${row("Qwen", q.n ? q : null)}${row("Haiku", h)}</tbody></table>`;
}

function accuracy() {
  const a = data.accuracy, t = a.trial.correct_of_4;
  const bars = Object.entries(t).map(([m, v], i) => `<text x="0" y="${i * 26 + 17}">${esc(m)}</text><rect x="70" y="${i * 26 + 5}" width="${(v / 4) * 300}" height="16" style="fill:${C[m]}"/><text x="${76 + (v / 4) * 300}" y="${i * 26 + 17}">${v} of 4</text>`).join("");
  const slot = (title, obj, refs) => `<tr><th>${title}</th>${Object.entries(obj).map(([w, v]) => v == null ? `<td class="pending">${esc(w)}: pending (${esc(refs[w])})</td>` : `<td>${esc(w)}: ${esc(v)}%</td>`).join("")}</tr>`;
  return `<p class="note"><strong>${esc(a.trial.label)}.</strong> This is the test run before Qwen went live, not live accuracy.</p>
    <svg viewBox="0 0 ${W} 82" role="img" aria-label="Trial: correct answers out of 4 by model">${bars}</svg>
    <table><tbody>${slot("Shadow agreement", a.shadow_agreement_pct, a.pending.shadow_agreement_pct)}${slot("Correction-free", a.correction_free_pct, a.pending.correction_free_pct)}</tbody></table>`;
}

// Freshness (site#60): when the aggregates were read, in Eastern time, plus an age the page keeps current.
// Older than 1 hour (the KV key's TTL; the refresh runs every 10 minutes) reads as stale.
export function renderFresh(d) {
  const asOf = d.as_of ? new Date(d.as_of) : null;
  const asOfText = asOf && !isNaN(asOf) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(asOf) : null;
  return asOfText
    ? `<span class="asof" data-asof="${esc(d.as_of)}"><span class="dot" aria-hidden="true"></span><span>Data as of <time datetime="${esc(d.as_of)}">${esc(asOfText)}</time><span class="age"></span></span></span>`
    : `<span class="asof stale"><span class="dot" aria-hidden="true"></span><span>Data time unknown: this snapshot carries no as-of stamp</span></span>`;
}

const JOB_NAMES = { triage: "Inbox triage", "issue-tag": "Issue labels", "cron-triage": "Cron triage", declutter: "Declutter", "session-reap": "Session reap", "learn-store-pick": "Learn store-pick" };
// Calls by day (site#88): one row per (day, job) that had calls, newest day first, plus a totals row per day. A job with no
// runs that day has no row. Counts only; the model names are fixed strings from the exporter.
function callsTable(rows) {
  if (!rows || !rows.length) return empty("No calls logged yet.");
  const days = [...new Set(rows.map((r) => r.day))];
  // Two layouts in one table, switched by CSS at 480px (page.css): wide shows Day and the three Haiku columns; phone drops
  // Day under a per-day heading row and folds the three Haiku columns into one "12 (11 fb · 1 cap · 11 shadow)" cell.
  const cells = (r) => `<td>${r.calls}</td><td>${r.qwen}</td><td class="wide">${r.haiku_fallback}</td><td class="wide">${r.haiku_capped}</td><td class="wide">${r.haiku_shadow}</td><td class="narrow">${r.haiku_fallback + r.haiku_capped} (${r.haiku_fallback} fb · ${r.haiku_capped} cap · ${r.haiku_shadow} shadow)</td>`;
  const sum = (rs) => Object.fromEntries(["calls", "qwen", "haiku_fallback", "haiku_capped", "haiku_shadow"].map((k) => [k, rs.reduce((s, r) => s + r[k], 0)]));
  const body = days.map((d) => {
    const rs = rows.filter((r) => r.day === d);
    return `<tr class="dayhead narrow"><th colspan="5" scope="colgroup">${esc(d)}</th></tr>`
      + rs.map((r) => `<tr><td class="wide">${esc(r.day)}</td><th scope="row">${esc(JOB_NAMES[r.job] || r.job)}</th>${cells(r)}</tr>`).join("")
      + `<tr class="total"><td class="wide">${esc(d)}</td><th scope="row">All jobs</th>${cells(sum(rs))}</tr>`;
  }).join("");
  const mq = rows[0].model_qwen, mh = rows[0].model_haiku;
  return `<details class="calls" open><summary>Calls by day</summary><div class="table-scroll"><table><thead><tr><th class="wide">Day</th><th>Job</th><th>Calls</th><th>Qwen</th><th class="wide">Haiku (fallback)</th><th class="wide">Haiku (cap)</th><th class="wide">Haiku (shadow)</th><th class="narrow">Haiku</th></tr></thead><tbody>${body}</tbody></table></div>
    <p class="note">Calls is items sent through the job. Qwen: answered by ${esc(mq)} on the local machine. Haiku (fallback, fb): Qwen failed or its answer was thrown out, so ${esc(mh)} did the item. Haiku (cap): the ramp held this item back from Qwen on purpose, or a fixed rule sends it to Haiku. Haiku (shadow): a second Haiku call made only to compare with Qwen's answer, counted on top of Calls. On a phone the three Haiku columns share one cell: fallback plus cap, then each part.</p></details>`;
}

const section = (id, title, why, body) => `<section id="${id}"><h2>${esc(title)}</h2><p class="why">${esc(why)}</p>${body}</section>`;

export function renderData(d) {
  data = d;
  const bd = data.breakdowns;
  return `${section("share", "Share on Qwen", "How much of the work Qwen took each day, and how much went back to Claude. This shows the ramp from 1 item to all.",
  `<div class="cols grid"><div><h3>Inbox triage</h3>${stacked(data.share_by_day.triage, "Triage items per day by who answered")}</div><div><h3>Issue labels</h3>${stacked(data.share_by_day["issue-tag"], "Issue-tag items per day by who answered")}</div></div>`)}
${section("workflows", "Every job that uses Qwen", "Each job's own counts by day, with when its log starts. A job with no runs logged shows that, not a rate.",
  `<div class="cols grid">${Object.keys(WORKFLOW_NAMES).map((k) => workflowBlock(k, (data.workflows || {})[k])).join("")}</div>`)}
${section("calls", "Calls by day", "How many calls each job made per day, and which model took them. Newest day first.", callsTable(data.calls_by_day))}
${section("fallbacks", "Fallback reasons", "Why Qwen's answer was thrown out and Claude did the item instead.", horizontal(data.fallback_reasons, "Fallbacks by reason", C.fell_back))}
${section("cost", "Cost per run", "Dollars per triage run over time, against the average before Qwen.", costChart())}
${section("latency", "Latency", "How long Qwen takes per item, next to Haiku.", latency())}
${section("accuracy", "Accuracy", "Whether the free model holds up. Live measures fill in as the checks land.", accuracy())}
${section("breakdowns", "Breakdowns", "The same counts cut three ways.",
  `<h3>By workflow</h3>${horizontal(Object.fromEntries(Object.entries(bd.by_workflow).map(([k, v]) => [k, v.answered])), "Items answered by Qwen, by workflow")}
   <h3>By tool call</h3>${horizontal(bd.by_tool_call, "Items by tool call")}
   <h3>By task label</h3>${horizontal(bd.by_task_label, "Triage items by label")}`)}`;
}
