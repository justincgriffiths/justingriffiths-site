// Builds the gated /fleet/meta/ page: dist/fleet/meta/index.html. The fixture (fleet/meta-fixture.json) is baked in
// so a preview renders; in production the page fetches /fleet/meta/state.json (Justin-only, src/worker.js) and redraws.
// Not linked from the hub, sitemap or nav: it exists only under /fleet/.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

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
<style>body{font:16px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:56rem;padding:0 1rem;color:#1A1A2E}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #ddd}th{font-weight:600}
small{color:#555}</style></head><body>
<h1>Meta rollout</h1>
<table><thead><tr><th>Client</th><th>Built</th><th>Verified</th><th>Live</th><th>State</th><th>First-hour impressions</th><th>Issues</th></tr></thead>
<tbody id="rows">${rows(doc)}</tbody></table>
<p><small id="stamp">${esc(doc.masked ? "Fixture data, clients masked. " : "")}Generated ${esc(doc.generated_at)}.</small></p>
<script>
const esc=${esc.toString()},yn=${yn.toString()},rows=${rows.toString()};
fetch("/fleet/meta/state.json",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{
  if(!d||!Array.isArray(d.clients))return;
  document.getElementById("rows").innerHTML=rows(d);
  document.getElementById("stamp").textContent=(d.masked?"Clients masked. ":"")+"Generated "+d.generated_at+".";
}).catch(()=>{});
</script></body></html>
`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = JSON.parse(readFileSync(new URL("./fleet/meta-fixture.json", import.meta.url), "utf8"));
  mkdirSync("dist/fleet/meta", { recursive: true });
  writeFileSync("dist/fleet/meta/index.html", page(doc));
  console.log("dist/fleet/meta/index.html");
}
