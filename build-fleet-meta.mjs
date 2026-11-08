// Builds the gated /fleet/meta/ page: dist/fleet/meta/index.html. The fixture (fleet/meta-fixture.json) is baked in
// so a preview renders; in production the page fetches /fleet/meta/state.json (Justin-only, src/worker.js) and redraws.
// Not linked from the hub, sitemap or nav: it exists only under /fleet/.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromeHead, siteHeader, NAV_SCRIPT } from "./src/chrome.mjs";

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const yn = (b) => (b ? "yes" : "no");
export function rows(doc) {
  return doc.clients.map((c) => `<tr><td>${esc(c.label)}</td><td>${yn(c.built)}</td><td>${yn(c.verified)}</td><td>${yn(c.live)}</td>` +
    `<td>${esc(c.state)}</td><td>${c.first_hour.impressions}${c.first_hour.delivering ? "" : " (not delivering)"}</td>` +
    `<td>${c.issues.length ? esc(c.issues.join(", ")) : "none"}</td></tr>`).join("");
}
export function page(doc) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Meta rollout</title>
${chromeHead()}
<style>.meta-page{padding-block:var(--space-10) var(--space-16)}.meta-page h1{font-size:var(--text-h1);line-height:var(--leading-tight);letter-spacing:var(--tracking-tight);margin-bottom:var(--space-6)}
.meta-page .scroll{overflow-x:auto}.meta-page table{border-collapse:collapse;width:100%;min-width:40rem;font-size:var(--text-body-sm);font-variant-numeric:tabular-nums}
.meta-page th,.meta-page td{text-align:left;padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--site-hairline)}
.meta-page thead th{font-size:var(--text-overline);letter-spacing:var(--tracking-wide);text-transform:uppercase;color:var(--site-text-soft);border-bottom:var(--border-width) solid var(--site-line)}
.meta-page small{color:var(--site-text-soft)}</style></head><body>
${siteHeader("fleet")}
<main class="wrap meta-page">
<h1>Meta rollout</h1>
<div class="scroll"><table><thead><tr><th>Client</th><th>Built</th><th>Verified</th><th>Live</th><th>State</th><th>First-hour impressions</th><th>Issues</th></tr></thead>
<tbody id="rows">${rows(doc)}</tbody></table></div>
<p><small id="stamp">${esc(doc.masked ? "Fixture data, clients masked. " : "")}Generated ${esc(doc.generated_at)}.</small></p>
<script>
const esc=${esc.toString()},yn=${yn.toString()},rows=${rows.toString()};
fetch("/fleet/meta/state.json",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d||!Array.isArray(d.clients))return;
  document.getElementById("rows").innerHTML=rows(d);
  document.getElementById("stamp").textContent=(d.masked?"Clients masked. ":"")+"Generated "+d.generated_at+".";
}).catch(()=>{});
</script></main>
${NAV_SCRIPT}
</body></html>
`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = JSON.parse(readFileSync(new URL("./fleet/meta-fixture.json", import.meta.url), "utf8"));
  mkdirSync("dist/fleet/meta", { recursive: true });
  writeFileSync("dist/fleet/meta/index.html", page(doc));
  console.log("dist/fleet/meta/index.html");
}
