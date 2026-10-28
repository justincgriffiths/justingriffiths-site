// Renders dist/index.html from bio.json. No dependencies: `node build.mjs`.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";

const bio = JSON.parse(readFileSync(new URL("./bio.json", import.meta.url), "utf8"));
const REPO = "https://github.com/justincgriffiths/justingriffiths-site";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const ext = (url) => (url.startsWith("mailto:") ? "" : ' rel="noopener"');
const a = (url, text, cls = "") => `<a href="${esc(url)}"${cls ? ` class="${cls}"` : ""}${ext(url)}>${text}</a>`;

const section = (n, label, body) => `
    <section class="section" style="--i:${n}">
      <h2 class="label"><span class="num">${String(n).padStart(2, "0")}</span>${esc(label)}</h2>
      ${body}
    </section>`;

const work = bio.work
  .map(
    (w) => `
        <li class="row">
          <div class="row-head">${a(w.url, esc(w.name), "name")}<span class="meta">${esc(w.role)}</span></div>
          <p class="note">${esc(w.summary)}</p>
        </li>`
  )
  .join("");

const links = bio.links
  .map((l) => `<li><span class="meta">${esc(l.label)}</span>${a(l.url, esc(l.value))}</li>`)
  .join("");

const people = bio.people
  .map(
    (g) => `
      <h3 class="group">${esc(g.group)}</h3>
      <ul class="rows">${g.entries
        .map(
          (p) => `
        <li class="row">
          <div class="row-head">${a(p.url, esc(p.name), "name")}${p.work ? `<cite>${esc(p.work)}</cite>` : ""}</div>
        </li>`
        )
        .join("")}
      </ul>`
  )
  .join("");

const now = new Date();
const updated = now.toISOString().slice(0, 10);
const dateline = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(bio.name)}</title>
  <meta name="description" content="${esc(bio.bio.short)}">
  <link rel="canonical" href="https://justingriffiths.com/">
  <meta property="og:title" content="${esc(bio.name)}">
  <meta property="og:description" content="${esc(bio.headline)}">
  <meta property="og:url" content="https://justingriffiths.com/">
  <meta property="og:type" content="profile">
  <meta name="color-scheme" content="light">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap" rel="stylesheet">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: bio.name,
    url: "https://justingriffiths.com",
    jobTitle: bio.work.map((w) => `${w.role}, ${w.name}`),
    homeLocation: bio.location,
    sameAs: bio.links.filter((l) => l.url.startsWith("https://") && !l.url.includes("justingriffiths.com")).map((l) => l.url),
  }).replace(/</g, "\\u003c")}</script>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="page">
    <header class="masthead">
      <h1 class="nameplate">${esc(bio.name)}</h1>
      <div class="dateline">
        <span>${esc(bio.location)}</span>
        <span>${esc(dateline)}</span>
        <span>justingriffiths.com</span>
      </div>
    </header>

    <article class="lede">
      <h2 class="headline">${esc(bio.headline)}</h2>
      <p class="story"><span class="drop">${esc(bio.bio.medium.slice(0, 1))}</span>${esc(bio.bio.medium.slice(1))}</p>
    </article>

    <main class="columns">${section(1, "Work", `<ul class="rows">${work}</ul>`)}${section(
      2,
      "People I learn from",
      people
    )}${section(3, "Elsewhere", `<ul class="links">${links}</ul>`)}${
      bio.working_to && bio.working_to.length
        ? section(4, "Working to", `<p class="note">${bio.working_to.map(esc).join(" &middot; ")}</p>`)
        : ""
    }
    </main>

    <footer class="footer">
      <p>Set from ${a(`${REPO}/blob/main/bio.json`, "bio.json")}, the same text I use on every profile. Updated ${updated}.</p>
    </footer>
  </div>
</body>
</html>
`;

mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/index.html", import.meta.url), html);
for (const f of ["style.css", "favicon.svg", "robots.txt"]) {
  const src = new URL(`./public/${f}`, import.meta.url);
  if (existsSync(src)) copyFileSync(src, new URL(`./dist/${f}`, import.meta.url));
}
console.log(`built dist/index.html (${html.length} bytes)`);
