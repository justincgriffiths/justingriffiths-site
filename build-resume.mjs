// Renders dist/resume/index.html from bio.json's `resume` block: full titles, verbatim from LinkedIn
// (site#82), one entry per role, grouped by company. Same chrome and night lane as the other pages.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { quietLink } from "./src/disclosure.mjs";
import { chromeHead, siteHeader, bookLink, NAV_SCRIPT } from "./src/chrome.mjs";

const { resume } = JSON.parse(readFileSync(new URL("./bio.json", import.meta.url), "utf8"));
if (!resume?.positions?.length) throw new Error("bio.json: missing resume.positions");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const role = (r) => `
        <li class="role">
          <h4 class="role-title">${esc(r.title)}</h4>
          <p class="role-dates">${esc(r.dates)}</p>${r.description ? `
          <p class="role-note">${esc(r.description)}</p>` : ""}
        </li>`;
const company = (c) => `
      <article class="company">
        <h3>${esc(c.company)}</h3>
        <ul class="roles">${c.roles.map(role).join("")}
        </ul>
      </article>`;
const school = (s) => `
      <article class="company">
        <h3>${esc(s.school)}</h3>
        <ul class="roles">
        <li class="role">${s.degree ? `
          <h4 class="role-title">${esc(s.degree)}</h4>` : ""}
          <p class="role-dates">${esc(s.dates)}</p>
          <p class="role-note">${esc(s.activity)}</p>
        </li>
        </ul>
      </article>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resume · Justin Griffiths</title>
<meta name="description" content="Justin Griffiths: roles and titles from Pearmill, Pedal Performance, TONE Exclusive, Ophelia, Nuts.com and Phillips, plus Oberlin and Regis.">
<link rel="canonical" href="https://justingriffiths.com/resume/"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
${chromeHead()}
<style>${readFileSync(new URL("./content/resume/page.css", import.meta.url), "utf8")}</style></head><body>
<a class="skip" href="#main">Skip to content</a>
${siteHeader("resume")}
<main id="main" class="center stack resume">
<h1>Resume</h1>
<p class="lede">The last ten years, with the full titles.</p>
<section aria-labelledby="positions"><h2 id="positions">Positions</h2>${resume.positions.map(company).join("")}
</section>
<section aria-labelledby="education"><h2 id="education">Education</h2>${resume.education.map(school).join("")}
</section>
<p class="learn-more">${quietLink("/", "Back to the home page")}</p>
</main>
<footer class="site-footer"><div class="wrap"><p>Titles and dates as listed on <a href="https://www.linkedin.com/in/justincgriffiths/" rel="noopener">LinkedIn</a>.</p>${bookLink()}</div></footer>
${NAV_SCRIPT}
</body></html>
`;

mkdirSync(new URL("./dist/resume/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/resume/index.html", import.meta.url), html);
console.log(`built dist/resume/index.html (${html.length} bytes)`);
