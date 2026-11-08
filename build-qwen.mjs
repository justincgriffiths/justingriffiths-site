// Renders dist/qwen/index.html (and dist/qwen/data.json) from content/qwen/data.json, which
// bin/qwen-state.sh writes. Public page: aggregates only. Every chart is inline SVG drawn from the rows.
// A null accuracy value renders as a marked "pending" slot (mycroft#668, skill-library#560), never a zero.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { disclosure, quietLink } from "./src/disclosure.mjs";
import { chromeHead, siteHeader, bookLink, NAV_SCRIPT } from "./src/chrome.mjs";
import { renderData, renderFresh } from "./src/qwen-render.mjs";

// Live refresh (site#78): the page inlines the renderer, then pulls /qwen/data.json (the Worker serves it from KV)
// every 5 minutes and re-renders in place. The built HTML above stays the no-JS fallback. A failed or malformed
// pull leaves the page as it is.
const RENDER_SRC = readFileSync(new URL("./src/qwen-render.mjs", import.meta.url), "utf8").replace(/^export /gm, "");
const LIVE_SCRIPT = `<script>(()=>{${RENDER_SRC}
const body=document.getElementById("qwen-data"),extra=document.querySelector("#data .disclosure-extra");let cur=document.querySelector(".asof")?.dataset.asof||"";
const STALE_H=1;
function age(){const p=document.querySelector(".asof"),t=p&&p.dataset.asof&&Date.parse(p.dataset.asof),h=(Date.now()-t)/36e5,a=p&&p.querySelector(".age");if(!a||!(h>=0))return;
const s=h<1?Math.max(1,Math.round(h*60))+" min ago":h<48?Math.round(h)+(Math.round(h)===1?" hour ago":" hours ago"):Math.round(h/24)+" days ago";
a.textContent=" · "+s+(h>STALE_H?" · stale":"");p.classList.toggle("stale",h>STALE_H);}
async function pull(){if(document.hidden)return;try{const r=await fetch("/qwen/data.json",{cache:"no-store"});if(!r.ok)return;const d=await r.json();
if(!d||typeof d!=="object"||!d.share_by_day||(d.as_of&&d.as_of===cur))return;const html=renderData(d),fresh=renderFresh(d);body.innerHTML=html;extra.innerHTML=fresh;cur=d.as_of||"";age();}catch(e){}}
age();setInterval(age,60000);setInterval(pull,300000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)pull();});})()</script>`;
const data = JSON.parse(readFileSync(new URL("./content/qwen/data.json", import.meta.url), "utf8"));
const fresh = renderFresh(data), dataBody = renderData(data);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Qwen rollout · Justin Griffiths</title>
<meta name="description" content="Aggregates from moving inbox triage and issue labels onto a free local model.">
<link rel="canonical" href="https://justingriffiths.com/qwen/"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${chromeHead()}
<style>${readFileSync(new URL("./content/qwen/page.css", import.meta.url), "utf8")}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
${siteHeader("qwen")}
<main id="main" class="center stack qwen">
<h1>Qwen rollout</h1>
${disclosure({ id: "background", title: "Background", body: `<p class="why">Coding with agents is expensive. At Pedal, we use Claude for almost everything, and managing cost without interrupting my work has been a constant challenge. I hit session token limits and weekly and monthly spend caps, and I switch models, accounts and credit cards to avoid running out during important work.</p>
<p class="why">This week, I analyzed my usage and found that much of my budget goes to work that is not client-facing and barely involves coding: cleanup, QA, reminders and documentation. Almost all of it is rote and repeated.</p>
<p class="why">I designed a game for my agents to encourage them to use free, open source models instead of relying solely on paid Anthropic models.</p>
<p class="why">Two chores moved from paid Claude calls to a free model running on my own machine (qwen3-coder:30b): sorting my inboxes and labeling GitHub issues. This page shows aggregates only: counts, dollars and milliseconds, never a message, sender or issue.</p>` })}
${disclosure({ id: "data", title: "Data", open: true, summaryExtra: fresh, body: `<div id="qwen-data">${dataBody}</div>` })}
${LIVE_SCRIPT}
<p class="learn-more">${quietLink("/#about", "Learn more")}</p>
</main>
<footer class="site-footer"><div class="wrap"><p>Part of the <a href="/#lab">Lab</a>. Aggregates only: counts, dollars and milliseconds.</p>${bookLink()}</div></footer>
${NAV_SCRIPT}
</body></html>
`;

mkdirSync(new URL("./dist/qwen/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/qwen/index.html", import.meta.url), html);
writeFileSync(new URL("./dist/qwen/data.json", import.meta.url), JSON.stringify(data));
console.log(`built dist/qwen/index.html (${html.length} bytes)`);
