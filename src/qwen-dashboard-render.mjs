// Renders the Tabler version of the Qwen dashboard (site: /qwen/dashboard/) from content/qwen/data.json and
// content/qwen/tests.json. Every number and every chart bar comes from a row in those files. A missing value
// renders as a marked "No data" chip, never a zero. Charts are inline SVG, like /qwen/. Aggregates only.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const has = (v) => v !== null && v !== undefined && !Number.isNaN(v);
const NONE = `<span class="badge bg-secondary-lt">No data</span>`;
export const ms = (v) => (!has(v) ? NONE : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
export const usd = (v, d = 4) => (!has(v) ? NONE : `$${Number(v).toFixed(d)}`);
export const pct = (a, b) => (!b ? null : Math.round((1000 * a) / b) / 10);
const pctText = (v) => (has(v) ? `${v}%` : NONE);
const num = (v) => (has(v) ? Number(v).toLocaleString("en-US") : NONE);
const day = (d) => d.slice(5);

// ---- charts (inline SVG; colors are Tabler variables, no hex) ----
export function hbars(rows, { fmt = String, w = 520, label = 150 } = {}) {
  const max = Math.max(...rows.map((r) => r.value || 0), 1), h = 26, bar = w - label - 90;
  const body = rows.map((r, i) => {
    const y = i * h, len = has(r.value) ? Math.max(1, (r.value / max) * bar) : 0;
    return `<text x="0" y="${y + 17}" class="c-label">${esc(r.label)}</text>` +
      (has(r.value) ? `<rect x="${label}" y="${y + 4}" width="${len.toFixed(1)}" height="16" rx="3" class="${r.cls || "c-main"}"><title>${esc(r.label)}: ${esc(fmt(r.value).replace(/<[^>]+>/g, ""))}</title></rect>` : "") +
      `<text x="${label + len + 6}" y="${y + 17}" class="c-value">${has(r.value) ? fmt(r.value) : "No data"}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${rows.length * h}" role="img" class="chart">${body}</svg>`;
}

export function columns(items, { fmt = String, w = 520, hgt = 150, line = null, values = false } = {}) {
  const max = Math.max(...items.map((r) => r.value || 0), line ? line.value : 0, 1), pad = 22, gap = 4;
  const bw = (w - 10) / items.length - gap, base = hgt - pad;
  const bars = items.map((r, i) => {
    const hh = has(r.value) ? Math.max(1, (r.value / max) * (base - 14)) : 0, x = 5 + i * (bw + gap);
    return `<rect x="${x.toFixed(1)}" y="${(base - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="2" class="${r.cls || "c-main"}"><title>${esc(r.label)}: ${esc(fmt(r.value).replace(/<[^>]+>/g, ""))}</title></rect>` +
      (values && has(r.value) ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(base - hh - 4).toFixed(1)}" text-anchor="middle" class="c-value">${fmt(r.value)}</text>` : "") +
      (i % Math.ceil(items.length / (w > 700 ? 20 : 8)) === 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${hgt - 6}" text-anchor="middle" class="c-axis">${esc(r.label)}</text>` : "");
  }).join("");
  const ref = line ? `<line x1="0" x2="${w}" y1="${(base - (line.value / max) * (base - 14)).toFixed(1)}" y2="${(base - (line.value / max) * (base - 14)).toFixed(1)}" class="c-ref"/><text x="${w}" y="${(base - (line.value / max) * (base - 14) - 4).toFixed(1)}" text-anchor="end" class="c-axis">${esc(line.label)}</text>` : "";
  return `<svg viewBox="0 0 ${w} ${hgt}" role="img" class="chart">${bars}${ref}</svg>`;
}

export function stacked(items, parts, { w = 520, hgt = 160 } = {}) {
  const totals = items.map((r) => parts.reduce((s, p) => s + (r[p.key] || 0), 0)), max = Math.max(...totals, 1);
  const pad = 22, gap = 4, bw = (w - 10) / items.length - gap, base = hgt - pad;
  const bars = items.map((r, i) => {
    let y = base; const x = 5 + i * (bw + gap);
    const segs = parts.map((p) => {
      const hh = ((r[p.key] || 0) / max) * (base - 14); y -= hh;
      return hh > 0 ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" class="${p.cls}"><title>${esc(r.label)}, ${esc(p.name)}: ${r[p.key]}</title></rect>` : "";
    }).join("");
    return segs + (i % Math.ceil(items.length / (w > 700 ? 20 : 8)) === 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${hgt - 6}" text-anchor="middle" class="c-axis">${esc(r.label)}</text>` : "");
  }).join("");
  return `<svg viewBox="0 0 ${w} ${hgt}" role="img" class="chart">${bars}</svg>`;
}

// one horizontal bar split into labeled shares (workflow rows, rung moves)
export function shares(parts, { w = 220 } = {}) {
  const total = parts.reduce((s, p) => s + (p.value || 0), 0);
  if (!total) return NONE;
  let x = 0;
  const segs = parts.filter((p) => p.value > 0).map((p) => { const len = (p.value / total) * w; const s = `<rect x="${x.toFixed(1)}" y="0" width="${len.toFixed(1)}" height="14" class="${p.cls}"><title>${esc(p.name)}: ${p.value}</title></rect>`; x += len; return s; }).join("");
  return `<svg viewBox="0 0 ${w} 14" role="img" class="chart-share">${segs}</svg>`;
}

const card = (title, body, { sub = "", cls = "col-lg-6" } = {}) =>
  `<div class="${cls}"><div class="card"><div class="card-header"><h3 class="card-title">${esc(title)}</h3></div><div class="card-body">${sub ? `<p class="text-secondary">${sub}</p>` : ""}${body}</div></div></div>`;
const kpi = (label, value, note) =>
  `<div class="col-sm-6 col-lg-3"><div class="card card-sm"><div class="card-body"><div class="subheader">${esc(label)}</div><div class="h1 mb-1">${value}</div><div class="text-secondary small">${note}</div></div></div></div>`;
const table = (head, rows, cls = "") =>
  `<div class="table-responsive"><table class="table table-vcenter card-table ${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="text-nowrap"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

// ---- tables shared by the dashboard and the writeups ----
export function shadowMatrix(sh) {
  if (!sh) return NONE;
  const labels = [...new Set(sh.counts.flatMap(([q, h]) => [q, h]))].sort();
  const get = (q, h) => (sh.counts.find((c) => c[0] === q && c[1] === h) || [0, 0, 0])[2];
  const rows = labels.map((q) => [`<strong>${esc(q)}</strong>`, ...labels.map((h) => { const n = get(q, h); return n ? `<span class="badge ${q === h ? "bg-green-lt" : "bg-orange-lt"}">${n}</span>` : `<span class="text-secondary">0</span>`; })]);
  return table(["Qwen label \\ Haiku label", ...labels], rows);
}
export function fillTable(ft) {
  if (!ft) return NONE;
  return table(["Rows given", "Cells to fill", "Attempts", "Cells correct per attempt", "Fully correct"],
    ft.map((r) => [num(r.rows), num(r.cells), num(r.attempts), esc(r.cells_correct.join(", ")), `${r.exact} of ${r.attempts}`]));
}
export function replayFields(lr) {
  if (!lr) return NONE;
  return table(["Field", "Compared with Haiku's labels", "Compared with today's labels"],
    Object.entries(lr.by_field).map(([f, v]) => [esc(f), `${v.vs_haiku.agree} of ${v.vs_haiku.n} (${pctText(pct(v.vs_haiku.agree, v.vs_haiku.n))})`, `${v.vs_today.agree} of ${v.vs_today.n} (${pctText(pct(v.vs_today.agree, v.vs_today.n))})`]));
}
export function rungVs(lr) {
  if (!lr) return NONE;
  const r = lr.rung_vs;
  return table(["Qwen's rung versus", "Cheaper", "Same", "Costlier", "Not comparable"],
    [["Haiku's rung", r.vs_haiku.cheaper, r.vs_haiku.same, r.vs_haiku.costlier, r.vs_haiku.not_comparable], ["Today's rung", r.vs_today.cheaper, r.vs_today.same, r.vs_today.costlier, r.vs_today.not_comparable]]);
}
export const TABLES = { shadow_matrix: (d, t) => shadowMatrix(t.triage_shadow), fill_table: (d, t) => fillTable(t.fill_table), replay_fields: (d, t) => replayFields(t.label_replay), rung_vs: (d, t) => rungVs(t.label_replay) };

// ---- the dashboard ----
export function renderDashboard(d, t, writeups) {
  const q = d.latency_ms.qwen, h = d.latency_ms.haiku, trial = d.accuracy.trial.correct_of_4, tag = d.cost_per_run.issue_tag_usd_per_item;
  const haikuName = (d.calls_by_day.find((r) => r.model_haiku) || {}).model_haiku;
  const wf = d.breakdowns.by_workflow, ag = d.accuracy.shadow_agreement_pct.triage;
  const fb = Object.values(d.fallback_reasons).reduce((a, b) => a + b, 0);
  const answered = Object.values(wf).reduce((a, w) => a + w.answered, 0), fell = Object.values(wf).reduce((a, w) => a + w.fell_back, 0);

  const kpis = [
    kpi("Triage agreement with Haiku", pctText(ag), `Same label on shadow pairs. ${t.triage_shadow ? `${t.triage_shadow.agree} of ${t.triage_shadow.total} in the latest audit rows.` : ""}`),
    kpi("Classify time, Qwen p50", ms(q.p50), `Haiku p50: ${ms(h && h.p50)}. Qwen p90: ${ms(q.p90)}.`),
    kpi("Triage cost per run", usd(d.cost_per_run.triage_qwen_era_usd_per_run), `Before Qwen: ${usd(d.cost_per_run.triage_baseline_usd_per_run)}.`),
    kpi("Fell back to Haiku", `${num(fell)} of ${num(answered + fell)}`, `Qwen calls recorded as errors: ${fb}.`),
  ].join("");

  const models = table(["Model", "Classify p50", "Classify p90", "Cost per issue label", "Pre-production trial"], [
    [`<strong>Qwen</strong> <span class="text-secondary">${esc(d.model)}</span>`, ms(q.p50), ms(q.p90), usd(tag.qwen), `${trial.qwen} of 4`],
    [`<strong>Haiku</strong> <span class="text-secondary">${esc(haikuName || "")}</span>`, ms(h && h.p50), ms(h && h.p90), usd(tag.haiku), `${trial.haiku} of 4`],
    [`<strong>Sonnet</strong>`, ms(null), ms(null), usd(null), `${trial.sonnet} of 4`],
    [`<strong>Opus</strong>`, ms(null), ms(null), usd(null), NONE],
  ]);

  const latency = hbars([
    { label: "Qwen p50", value: q.p50, cls: "c-main" }, { label: "Qwen p90", value: q.p90, cls: "c-main-soft" },
    { label: "Haiku p50", value: h && h.p50, cls: "c-alt" }, { label: "Haiku p90", value: h && h.p90, cls: "c-alt-soft" },
  ], { fmt: ms });

  const tri = d.cost_per_run.triage_by_day;
  const cost = columns(tri.map((r) => ({ label: day(r.day), value: r.usd_per_run, cls: r.qwen_era ? "c-main" : "c-alt" })), { fmt: (v) => usd(v), line: { value: d.cost_per_run.triage_baseline_usd_per_run, label: "before Qwen" } });

  const byDay = {};
  for (const r of d.calls_by_day) { const x = byDay[r.day] || (byDay[r.day] = { label: day(r.day), qwen: 0, fallback: 0, capped: 0, shadow: 0 }); x.qwen += r.qwen; x.fallback += r.haiku_fallback; x.capped += r.haiku_capped; x.shadow += r.haiku_shadow; }
  const days = Object.entries(byDay).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
  const parts = [{ key: "qwen", name: "Answered by Qwen", cls: "c-main" }, { key: "fallback", name: "Haiku after a Qwen failure", cls: "c-bad" }, { key: "capped", name: "Haiku, ramp cap", cls: "c-alt" }, { key: "shadow", name: "Haiku shadow check", cls: "c-alt-soft" }];
  const calls = stacked(days, parts, { w: 1040, hgt: 200 }) +`<div class="legend">${parts.map((p) => `<span><i class="${p.cls}"></i>${p.name}</span>`).join("")}</div>`;

  const wfRows = Object.entries(wf).map(([name, w]) => {
    const full = d.workflows[name] || {}, lat = full.latency_ms;
    return [`<strong>${esc(name)}</strong>`, num(w.answered), num(w.fell_back), num(w.capped), (full.policy_reasons && Object.keys(full.policy_reasons).length) ? num(full.policy) : num(full.policy || 0),
      shares([{ value: w.answered, cls: "c-main", name: "Answered" }, { value: w.fell_back, cls: "c-bad", name: "Fell back" }, { value: w.capped, cls: "c-alt", name: "Capped" }]),
      lat && has(lat.p50) ? `${ms(lat.p50)} per ${esc(lat.unit)}` : NONE, full.usd !== undefined ? usd(full.usd) : NONE];
  });
  const workflows = table(["Workflow", "Answered", "Fell back", "Capped", "Fixed rule", "Share", "Latency p50", "Spend"], wfRows) +
    `<div class="legend"><span><i class="c-main"></i>Answered by Qwen</span><span><i class="c-bad"></i>Fell back to Haiku</span><span><i class="c-alt"></i>Capped to Haiku by the ramp</span><span>Fixed rule: sent to Haiku by a standing rule</span></div>`;

  const sh = t.triage_shadow;
  const shadow = sh ? shadowMatrix(sh) + `<p class="text-secondary mt-2">${sh.agree} of ${sh.total} pairs match (${pctText(pct(sh.agree, sh.total))}). ${sh.missing_label} more pair rows have no label on one side and are not counted.</p>` : NONE;

  const ft = t.fill_table;
  const fill = ft ? columns(ft.map((r) => ({ label: `${r.rows} ${r.rows === 1 ? "row" : "rows"}`, value: pct(r.cells_correct.reduce((a, b) => a + b, 0) / r.attempts, r.cells), cls: "c-main" })), { fmt: (v) => `${v}%`, hgt: 150, values: true }) + `<p class="text-secondary mt-2">Share of table cells correct, by number of input rows, averaged over ${ft[0].attempts} attempts.</p>` : NONE;

  const lr = t.label_replay;
  const agree = lr ? hbars(Object.entries(lr.by_field).flatMap(([f, v]) => [
    { label: `${f} vs Haiku`, value: pct(v.vs_haiku.agree, v.vs_haiku.n), cls: "c-main" }, { label: `${f} vs today`, value: pct(v.vs_today.agree, v.vs_today.n), cls: "c-alt" }]), { fmt: (v) => `${v}%` }) : NONE;
  const rungShare = lr ? `<div class="mt-3"><div class="subheader mb-1">Qwen's rung versus Haiku's rung</div>${shares([{ value: lr.rung_vs.vs_haiku.cheaper, cls: "c-main", name: "Cheaper" }, { value: lr.rung_vs.vs_haiku.same, cls: "c-alt-soft", name: "Same" }, { value: lr.rung_vs.vs_haiku.costlier, cls: "c-bad", name: "Costlier" }], { w: 480 })}<div class="legend"><span><i class="c-main"></i>Cheaper ${lr.rung_vs.vs_haiku.cheaper}</span><span><i class="c-alt-soft"></i>Same ${lr.rung_vs.vs_haiku.same}</span><span><i class="c-bad"></i>Costlier ${lr.rung_vs.vs_haiku.costlier}</span></div></div>` : "";

  const links = writeups.map((w) => `<a class="list-group-item list-group-item-action" href="writeups/${esc(w.slug)}/"><div class="fw-bold">${esc(w.title)}</div><div class="text-secondary">${esc(w.summary)}</div></a>`).join("");

  return `<div class="page"><div class="page-wrapper">
<div class="page-header d-print-none"><div class="container-xl"><div class="row align-items-center"><div class="col">
<div class="page-pretitle"><a href="/qwen/">Qwen rollout</a></div><h1 class="page-title">Model performance</h1>
<div class="text-secondary mt-1">Counts, dollars and milliseconds from the Qwen aggregates (${esc(d.as_of)}) and the completion tests (${esc(t.as_of)}). Aggregates only.</div>
</div></div></div></div>
<div class="page-body"><div class="container-xl"><div class="row row-deck row-cards">
${kpis}
${card("Models side by side", models, { cls: "col-12", sub: "Classify time is the inbox label call. Cost per issue label is dollars for one GitHub issue label call. The trial is a four-item test before Qwen went live." })}
${card("Classify time", latency, { sub: "Median and 90th percentile, milliseconds, per model." })}
${card("Triage cost per run", cost, { sub: "Dollars per run, by day. Blue days ran with Qwen." })}
${card("Calls by day", calls, { cls: "col-12", sub: "Every classify call, by who answered." })}
${card("By workflow", workflows, { cls: "col-12", sub: "What each job sent to Qwen and what came back." })}
${card("Triage: Qwen and Haiku on the same items", shadow, { sub: "Each cell counts items where Qwen gave the row label and Haiku gave the column label." })}
${card("Fill a table from raw rows", fill)}
${card("Issue labels replayed through Qwen", agree + rungShare, { sub: t.label_replay ? `${t.label_replay.replayed} past issues. Share where Qwen's label matches the one Haiku applied, and the one on the issue today, by field.` : "" })}
${card("Writeups", `<div class="list-group list-group-flush">${links}</div>`, { sub: "Observations on the numbers above, one page each." })}
</div></div></div>
<footer class="footer footer-transparent d-print-none"><div class="container-xl text-secondary">Part of the <a href="/#lab">Lab</a>. Aggregates only: counts, dollars and milliseconds. Built with Tabler 1.7.4 (MIT).</div></footer>
</div></div>`;
}

// ---- writeups: small markdown subset (headings, paragraphs, lists, pipe tables) with {{placeholders}} ----
// dotted path into the data; "first" and "last" pick the ends of a list
const lookup = (obj, path) => path.split(".").reduce((o, k) => (o === undefined || o === null ? undefined : Array.isArray(o) && k === "first" ? o[0] : Array.isArray(o) && k === "last" ? o[o.length - 1] : o[k]), obj);
export function fill(md, d, t) {
  const root = { data: d, tests: t };
  return md.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (all, expr) => {
    let v;
    if (expr.startsWith("table:")) { const f = TABLES[expr.slice(6)]; if (!f) throw new Error(`unknown table ${expr}`); return `\n\n<!--html-->${f(d, t)}\n\n`; }
    if (expr.startsWith("pct:")) { const [a, b] = expr.slice(4).split("/").map((p) => lookup(root, p)); v = pct(a, b); }
    else if (expr.startsWith("cell:")) { const [qq, hh] = expr.slice(5).split(","); const c = ((t.triage_shadow || {}).counts || []).find((x) => x[0] === qq && x[1] === hh); v = c ? c[2] : 0; }
    else v = lookup(root, expr);
    if (v === undefined || v === null) throw new Error(`placeholder ${all} has no value`);
    return String(v);
  });
}
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
export function mdToHtml(md) {
  const out = [], lines = md.split("\n"); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith("<!--html-->")) { out.push(l.slice(11)); i++; continue; }
    const hm = l.match(/^(#{2,3})\s+(.*)$/);
    if (hm) { out.push(`<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`); i++; continue; }
    if (/^- /.test(l)) { const li = []; while (i < lines.length && /^- /.test(lines[i])) li.push(`<li>${inline(lines[i++].slice(2))}</li>`); out.push(`<ul>${li.join("")}</ul>`); continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|- |<!--html-->)/.test(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return out.join("\n");
}
export function parseWriteup(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("writeup needs front matter");
  const meta = Object.fromEntries(m[1].split("\n").map((x) => { const i = x.indexOf(":"); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }));
  if (!meta.title || !meta.summary) throw new Error("writeup front matter needs title and summary");
  return { meta, body: m[2] };
}
export function renderWriteup(meta, bodyHtml, d, t) {
  return `<div class="page"><div class="page-wrapper">
<div class="page-header d-print-none"><div class="container-xl"><div class="row align-items-center"><div class="col">
<div class="page-pretitle"><a href="../../">Model performance</a></div><h1 class="page-title">${esc(meta.title)}</h1>
<div class="text-secondary mt-1">Numbers as of ${esc(d.as_of)} (aggregates) and ${esc(t.as_of)} (tests).</div></div></div></div></div>
<div class="page-body"><div class="container-xl"><div class="row"><div class="col-lg-9"><div class="card"><div class="card-body markdown">${bodyHtml}</div></div></div></div></div></div>
<footer class="footer footer-transparent d-print-none"><div class="container-xl text-secondary"><a href="../../">Back to the dashboard</a>. Aggregates only: counts, dollars and milliseconds.</div></footer>
</div></div>`;
}
