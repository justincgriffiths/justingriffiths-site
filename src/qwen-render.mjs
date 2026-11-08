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
  // One day of data is a single datapoint (a big number and who answered), never a lone bar (site#88).
  if (rows.length === 1) {
    const r = rows[0], n = keys.reduce((s, k) => s + r[k], 0), names = { answered: "answered by Qwen", fell_back: "fell back to Claude", capped: "capped", policy: "held back by rule" };
    return `<p class="single"><span class="big">${n}</span> ${n === 1 ? "item" : "items"} on ${esc(r.day)}</p><p class="note">${keys.map((k) => `${r[k]} ${names[k]}`).join(" · ")}. First day logged, so there is no history to chart yet.</p>`;
  }
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
// Calls by day (site#88): one history chart per job. Every day from the job's first logged day to the newest day in the data
// gets a bar, a day with no calls as an empty slot (zero height), never skipped. Stacked by model: Qwen, Haiku fallback,
// Haiku cap. Haiku shadow is a hollow ring on the same axis, not part of the stack (it is on top of Calls). A job logged on
// one day only is a single datapoint (big number and a model split), never a lone bar.
const dayAdd = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const CALL_KEYS = [["qwen", "Qwen", C.qwen], ["haiku_fallback", "Haiku fallback", C.fell_back], ["haiku_capped", "Haiku cap", C.capped]];
const callsLegend = (items) => `<p class="legend cluster">${items.map(([k, c, ring]) => `<span><i style="${ring ? `border:2px solid ${c}` : `background:${c}`}"></i>${esc(k)}</span>`).join("")}</p>`;

function callsOne(name, rs, last) {
  const by = Object.fromEntries(rs.map((r) => [r.day, r])), first = rs.map((r) => r.day).sort()[0];
  const total = rs.reduce((s, r) => s + r.calls, 0), sh = rs.reduce((s, r) => s + r.haiku_shadow, 0);
  const sum = (k) => rs.reduce((s, r) => s + r[k], 0);
  if (rs.length === 1) {
    const r = rs[0];
    return `<div class="callsjob"><h3>${esc(name)}</h3><p class="single"><span class="big">${r.calls}</span> ${r.calls === 1 ? "call" : "calls"} on ${esc(r.day)}</p>
      <p class="note">${r.qwen} Qwen · ${r.haiku_fallback} Haiku fallback · ${r.haiku_capped} Haiku cap${r.haiku_shadow ? ` · ${r.haiku_shadow} Haiku shadow (on top)` : ""}. First day logged, so there is no history to chart yet.</p></div>`;
  }
  const days = []; for (let d = first; d <= last; d = dayAdd(d, 1)) days.push(d);
  const max = Math.max(1, ...days.map((d) => Math.max(by[d] ? by[d].calls : 0, by[d] ? by[d].haiku_shadow : 0)));
  const step = (W - P.l - P.r) / days.length, bw = Math.max(2, Math.min(28, step - 4)), ph = H - P.t - P.b, yv = (v) => (v / max) * ph;
  const bars = days.map((d, i) => {
    const r = by[d], x = P.l + i * step + (step - bw) / 2; let y = H - P.b;
    if (!r) return `<rect x="${x}" y="${H - P.b - 1}" width="${bw}" height="1" class="gridline"><title>${esc(d)}: no calls</title></rect>`;
    const segs = CALL_KEYS.map(([k, lab, c]) => { const h = yv(r[k]); y -= h; return h ? `<rect x="${x}" y="${y}" width="${bw}" height="${h}" style="fill:${c};stroke:var(--site-bg);stroke-width:1"><title>${esc(d)} ${lab}: ${r[k]}</title></rect>` : ""; }).join("");
    const ring = r.haiku_shadow ? `<circle cx="${x + bw / 2}" cy="${H - P.b - yv(r.haiku_shadow)}" r="5" fill="none" style="stroke:${C.haiku}" stroke-width="2"><title>${esc(d)} Haiku shadow: ${r.haiku_shadow}</title></circle>` : "";
    return segs + ring;
  }).join("");
  // At most 3 date labels (first, middle, last) so they stay legible at 390px.
  const idx = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  const ticks = idx.map((i) => `<text x="${P.l + i * step + step / 2}" y="${H - 10}" text-anchor="${i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}">${esc(days[i].slice(5))}</text>`).join("");
  const axis = [0, max].map((v) => { const y = H - P.b - yv(v); return `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="gridline"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end">${v}</text>`; }).join("");
  const parts = [`first logged ${esc(first)}`, `${total} calls`, `${sum("qwen")} Qwen`, `${sum("haiku_fallback")} Haiku fallback`, `${sum("haiku_capped")} Haiku cap`];
  if (sh) parts.push(`${sh} Haiku shadow (on top)`);
  return `<div class="callsjob"><h3>${esc(name)}</h3><p class="note">${parts.join(" · ")}.</p>${svg(`${name} calls per day by model, ${days.length} days`, axis + bars + ticks)}</div>`;
}

function callsCharts(rows) {
  if (!rows || !rows.length) return empty("No calls logged yet.");
  const last = rows.map((r) => r.day).sort().pop();
  const jobs = Object.keys(JOB_NAMES).filter((j) => rows.some((r) => r.job === j)).concat([...new Set(rows.map((r) => r.job))].filter((j) => !JOB_NAMES[j]));
  const mq = rows[0].model_qwen, mh = rows[0].model_haiku;
  return callsLegend([["Qwen", C.qwen], ["Haiku fallback", C.fell_back], ["Haiku cap", C.capped], ["Haiku shadow", C.haiku, true]])
    + `<div class="cols grid">${jobs.map((j) => callsOne(JOB_NAMES[j] || j, rows.filter((r) => r.job === j), last)).join("")}</div>
    <p class="note">One bar per day, from each job's first logged day; a day with no calls is an empty slot. Calls is items sent through the job. Qwen: answered by ${esc(mq)} on the local machine. Haiku fallback: Qwen failed or its answer was thrown out, so ${esc(mh)} did the item. Haiku cap: the ramp held this item back from Qwen on purpose, or a fixed rule sends it to Haiku. Haiku shadow (ring): a second Haiku call made only to compare with Qwen's answer, counted on top of Calls.</p>`;
}

// History (site#90): wrap, PR sweeps and session cleanup, one chart each. Every day from the command's first record to the
// data's last day gets a slot (an empty day is a hairline, never skipped). Bars stack by model. Dollars are not a second axis:
// the savings line carries the 7-day spend and the busiest-spend day is labeled on the chart. One day of data is one number.
const HM = { opus: ["Opus", C.fell_back], sonnet: ["Sonnet", C.sonnet], haiku: ["Haiku", C.haiku], "qwen3-coder:30b": ["Qwen", C.qwen], script: ["Script (no model)", C.capped], other: ["Other model", C.capped], "not logged": ["Model not logged", C.capped] };
const HNAMES = { wrap: "Wrap", "pr-sweep": "PR sweeps", "session-cleanup": "Session cleanup" };
const runsOf = (n) => `${n} ${n === 1 ? "run" : "runs"}`;
const usd = (v) => `$${v >= 100 ? Math.round(v) : v.toFixed(2)}`;

function savingsLine(sv) {
  if (!sv.cost_logged) return `<p class="savings"><strong>Last 7 days:</strong> ${runsOf(sv.last7_runs)} against ${sv.prior7_runs} the 7 days before. Cost not logged, so no savings figure.</p>`;
  return `<p class="savings"><strong>Last 7 days:</strong> ${usd(sv.last7_usd)} over ${runsOf(sv.last7_runs)}, against ${usd(sv.prior7_usd)} over ${runsOf(sv.prior7_runs)} the 7 days before.</p>`;
}

function historyOne(c, last) {
  const name = HNAMES[c.command] || c.command;
  if (!c.days.length) return `<div class="callsjob"><h3>${esc(name)}</h3>${empty("No runs logged.")}</div>`;
  const by = Object.fromEntries(c.days.map((r) => [r.day, r])), first = c.days[0].day;
  const used = [...new Set(c.days.flatMap((r) => Object.keys(r.models)))], keys = Object.keys(HM).filter((k) => used.includes(k)).concat(used.filter((k) => !HM[k]));
  const lab = (k) => (HM[k] || [k, C.capped])[0], col = (k) => (HM[k] || [k, C.capped])[1];
  const head = `<h3>${esc(name)}</h3>${savingsLine(c.savings)}`;
  const note = (extra) => `<p class="note">first logged ${esc(first)} · ${c.runs} ${c.runs === 1 ? "run" : "runs"}${c.usd == null ? " · cost not logged" : ` · ${usd(c.usd)} spent`}${extra}.</p>`;
  const mk = c.marker && c.marker.day ? ` · ${esc(c.marker.label)} since ${esc(c.marker.day)}` : "";
  if (c.days.length === 1) {
    const r = c.days[0];
    return `<div class="callsjob">${head}<p class="single"><span class="big">${r.runs}</span> ${r.runs === 1 ? "run" : "runs"} on ${esc(r.day)}</p>${note(`${mk}. First day logged, so there is no history to chart yet`)}</div>`;
  }
  const days = []; for (let d = first; d <= last; d = dayAdd(d, 1)) days.push(d);
  const max = Math.max(1, ...c.days.map((r) => r.runs)), step = (W - P.l - P.r) / days.length, bw = Math.max(2, Math.min(28, step - 4)), ph = H - P.t - P.b, yv = (v) => (v / max) * ph;
  const top = c.usd == null ? null : c.days.reduce((a, r) => ((r.usd || 0) > (a.usd || 0) ? r : a));
  const bars = days.map((d, i) => {
    const r = by[d], x = P.l + i * step + (step - bw) / 2; let y = H - P.b;
    if (!r) return `<rect x="${x}" y="${H - P.b - 1}" width="${bw}" height="1" class="gridline"><title>${esc(d)}: no runs</title></rect>`;
    return keys.map((k) => { const n = r.models[k] || 0, h = yv(n); y -= h; return h ? `<rect x="${x}" y="${y}" width="${bw}" height="${h}" style="fill:${col(k)};stroke:var(--site-bg);stroke-width:1"><title>${esc(d)} ${esc(lab(k))}: ${n}${r.usd == null ? "" : `, ${usd(r.usd)}`}</title></rect>` : ""; }).join("");
  }).join("");
  const peak = top && top.usd > 0 ? (() => { const i = days.indexOf(top.day), x = P.l + i * step + step / 2, anchor = i > days.length / 2 ? "end" : "start"; return `<text x="${x}" y="${H - P.b - yv(top.runs) - 4}" text-anchor="${anchor}">${usd(top.usd)}</text>`; })() : "";
  const mi = c.marker && c.marker.day ? days.indexOf(c.marker.day) : -1;
  const mark = mi >= 0 ? `<line x1="${P.l + mi * step + step / 2}" x2="${P.l + mi * step + step / 2}" y1="${P.t}" y2="${H - P.b}" class="trend" stroke-dasharray="4 3"/><text x="${P.l + mi * step + step / 2 + (mi > days.length / 2 ? -4 : 4)}" y="${P.t + 10}" text-anchor="${mi > days.length / 2 ? "end" : "start"}">${esc(c.marker.label)}</text>` : "";
  const idx = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  const ticks = idx.map((i) => `<text x="${P.l + i * step + step / 2}" y="${H - 10}" text-anchor="${i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}">${esc(days[i].slice(5))}</text>`).join("");
  const axis = [0, max].map((v) => { const y = H - P.b - yv(v); return `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="gridline"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end">${v}</text>`; }).join("");
  return `<div class="callsjob">${head}${note(`${mk}${top && top.usd > 0 ? `; the label marks the costliest day, ${esc(top.day.slice(5))}` : ""}`)}${legend(keys.map((k) => [lab(k), col(k)]))}${svg(`${name} runs per day by model, ${days.length} days`, axis + bars + mark + peak + ticks)}</div>`;
}

function historyCharts(h) {
  if (!h || !h.commands || !h.commands.some((c) => c.days.length)) return empty("No history logged yet.");
  return `<div class="cols grid">${h.commands.map((c) => historyOne(c, h.through)).join("")}</div>
    <p class="note">Runs per day, from each command's first record; a day with no runs is an empty slot. Savings compares the last 7 days with the 7 before, from dollars the command's own log records. Where no cost is logged the page says so and does not estimate. Wrap's day is the day its record was written.</p>`;
}

const section = (id, title, why, body) => `<section id="${id}"><h2>${esc(title)}</h2><p class="why">${esc(why)}</p>${body}</section>`;

export function renderData(d) {
  data = d;
  const bd = data.breakdowns;
  return `${section("share", "Share on Qwen", "How much of the work Qwen took each day, and how much went back to Claude. This shows the ramp from 1 item to all.",
  `<div class="cols grid"><div><h3>Inbox triage</h3>${stacked(data.share_by_day.triage, "Triage items per day by who answered")}</div><div><h3>Issue labels</h3>${stacked(data.share_by_day["issue-tag"], "Issue-tag items per day by who answered")}</div></div>`)}
${section("workflows", "Every job that uses Qwen", "Each job's own counts by day, with when its log starts. A job with no runs logged shows that, not a rate.",
  `<div class="cols grid">${Object.keys(WORKFLOW_NAMES).map((k) => workflowBlock(k, (data.workflows || {})[k])).join("")}</div>`)}
${section("calls", "Calls by day", "How many calls each job made per day since it started, and which model took them.", callsCharts(data.calls_by_day))}
${section("history", "History and savings", "Runs per day for wrap, PR sweeps and session cleanup, by model, with the last 7 days of spend against the 7 before.", historyCharts(data.history))}
${section("fallbacks", "Fallback reasons", "Why Qwen's answer was thrown out and Claude did the item instead.", horizontal(data.fallback_reasons, "Fallbacks by reason", C.fell_back))}
${section("cost", "Cost per run", "Dollars per triage run over time, against the average before Qwen.", costChart())}
${section("latency", "Latency", "How long Qwen takes per item, next to Haiku.", latency())}
${section("accuracy", "Accuracy", "Whether the free model holds up. Live measures fill in as the checks land.", accuracy())}
${section("breakdowns", "Breakdowns", "The same counts cut three ways.",
  `<h3>By workflow</h3>${horizontal(Object.fromEntries(Object.entries(bd.by_workflow).map(([k, v]) => [k, v.answered])), "Items answered by Qwen, by workflow")}
   <h3>By tool call</h3>${horizontal(bd.by_tool_call, "Items by tool call")}
   <h3>By task label</h3>${horizontal(bd.by_task_label, "Triage items by label")}`)}`;
}
