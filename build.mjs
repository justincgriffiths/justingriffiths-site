// Renders dist/index.html from bio.json. No dependencies: `node build.mjs`.
//
// The page is a dossier: a cover sheet, an index, then numbered sections. Everything
// the page shows comes from bio.json. `bio.dossier` says what goes where; the canonical
// text (name, headline, bios, work, links, people) stays in the top-level keys, and
// blocks point at it with `from`. The block types are documented in the README.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";

const bio = JSON.parse(readFileSync(new URL("./bio.json", import.meta.url), "utf8"));
const REPO = "https://github.com/justincgriffiths/justingriffiths-site";
const { dossier } = bio;
if (!dossier || !Array.isArray(dossier.sections)) throw new Error("bio.json: missing dossier.sections");

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ext = (url) => (url.startsWith("mailto:") || url.startsWith("#") ? "" : ' rel="noopener"');
const a = (url, text, cls = "") => `<a href="${esc(url)}"${cls ? ` class="${cls}"` : ""}${ext(url)}>${text}</a>`;
const pad = (n) => String(n).padStart(2, "0");

// "links.0.value" -> bio.links[0].value. Throws on a bad path so a typo fails the build.
const get = (path) => {
  const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), bio);
  if (v === undefined) throw new Error(`bio.json: "${path}" does not resolve`);
  return v;
};
const items = (block) => (block.from ? get(block.from) : block.items) ?? [];

// A fact value: a string, an object ({value} or {role, name}, optional url), or a list of those.
const factValue = (v) => {
  if (Array.isArray(v)) return v.map((x) => `<span class="line">${factValue(x)}</span>`).join("");
  if (v && typeof v === "object") {
    const text = esc(v.value ?? [v.role, v.name].filter(Boolean).join(", "));
    return v.url ? a(v.url, text) : text;
  }
  return esc(v);
};
const facts = (rows) => `
        <dl class="facts">${rows
          .map((r) => `
          <div class="fact"><dt>${esc(r.label)}</dt><dd>${factValue(r.from ? get(r.from) : r)}</dd></div>`)
          .join("")}
        </dl>`;

// Exhibits are lettered A, B, C... in page order, cover portrait first.
let exhibitCount = 0;
const letter = (n) => (n < 26 ? String.fromCharCode(65 + n) : letter(Math.floor(n / 26) - 1) + letter(n % 26));

const media = (x) => {
  const alt = esc(x.alt ?? x.caption ?? "");
  if (x.placeholder || !x.src) {
    const kind = { image: "Photo", video: "Video", audio: "Audio", embed: "Embed" }[x.type] ?? "Media";
    return `<div class="placeholder" role="img" aria-label="Placeholder: ${alt}"><span>Placeholder</span><span>${kind} pending approval</span></div>`;
  }
  switch (x.type) {
    case "image":
      return `<img src="${esc(x.src)}" alt="${alt}" loading="lazy" decoding="async"${x.color ? ' class="color"' : ""}>`;
    case "video":
      return `<video controls preload="metadata"${x.poster ? ` poster="${esc(x.poster)}"` : ""} src="${esc(x.src)}" aria-label="${alt}"></video>`;
    case "audio":
      return `<audio controls preload="metadata" src="${esc(x.src)}" aria-label="${alt}"></audio>`;
    case "embed":
      return `<iframe src="${esc(x.src)}" title="${alt}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    default:
      throw new Error(`bio.json: unknown exhibit type "${x.type}"`);
  }
};
const exhibit = (x, cls = "") => {
  const id = letter(exhibitCount++);
  const credit = x.credit ? ` <span class="credit">${x.credit_url ? a(x.credit_url, esc(x.credit)) : esc(x.credit)}</span>` : "";
  return `
          <figure class="exhibit exhibit-${esc(x.type ?? "image")}${cls ? ` ${cls}` : ""}" id="exhibit-${id.toLowerCase()}"${
            x.aspect ? ` style="--aspect:${esc(x.aspect)}"` : ""
          }>
            <div class="frame">${media(x)}</div>
            <figcaption><span class="tag">Exhibit ${id}</span>${x.caption ? ` ${esc(x.caption)}` : ""}${credit}</figcaption>
          </figure>`;
};

const blocks = {
  prose: (b) => {
    const v = b.from ? get(b.from) : b.text;
    return (Array.isArray(v) ? v : [v]).map((p) => `
        <p class="prose">${esc(p)}</p>`).join("");
  },
  facts: (b) => facts(items(b)),
  entries: (b) => `
        <ul class="entries">${items(b)
          .map((e) => `
          <li class="entry">
            <div class="entry-head">${e.url ? a(e.url, esc(e.name), "name") : `<span class="name">${esc(e.name)}</span>`}${
              e.role ? `<span class="meta">${esc(e.role)}</span>` : ""
            }${e.work ? `<cite>${esc(e.work)}</cite>` : ""}</div>${e.summary ? `
            <p class="note">${esc(e.summary)}</p>` : ""}
          </li>`)
          .join("")}
        </ul>`,
  groups: (b) =>
    items(b)
      .map((g) => `
        <h3 class="group">${esc(g.group)}</h3>${blocks.entries({ items: g.entries })}`)
      .join(""),
  exhibits: (b) => `
        <div class="exhibits">${items(b).map((x) => exhibit(x)).join("")}
        </div>`,
  logos: (b) => `
        <ul class="logos" aria-label="${esc(b.label ?? "Organizations")}">${items(b)
          .map((l) => {
            const mark =
              l.placeholder || !l.src
                ? `<span class="logo-ph" role="img" aria-label="Placeholder: ${esc(l.name)} logo"><span>${esc(l.name)}</span><small>Logo pending</small></span>`
                : `<img src="${esc(l.src)}" alt="${esc(l.name)}" loading="lazy">`;
            return `
          <li>${l.url ? a(l.url, mark) : mark}</li>`;
          })
          .join("")}
        </ul>`,
};
const renderBlock = (b) => {
  const fn = blocks[b.type];
  if (!fn) throw new Error(`bio.json: unknown block type "${b.type}"`);
  return fn(b);
};

const updated = new Date().toISOString().slice(0, 10);
const { cover = {} } = dossier;

const coverSheet = `
    <header class="cover" aria-labelledby="subject">
      <div class="cover-file">
        <span>Personal file</span>
        <span>Updated <time datetime="${updated}">${updated}</time></span>
      </div>
      <div class="cover-body">
        ${cover.portrait ? exhibit(cover.portrait, "portrait") : ""}
        <div class="cover-id">
          <p class="kicker">Subject</p>
          <h1 id="subject">${esc(bio.name)}</h1>
          ${cover.lede ? `<p class="lede">${esc(get(cover.lede))}</p>` : ""}
          ${cover.facts ? facts(cover.facts) : ""}
        </div>
      </div>
      <nav class="index" aria-label="Contents">
        <h2 class="kicker">Index</h2>
        <ol>${dossier.sections
          .map((s, i) => `
          <li><a href="#${esc(s.id)}"><span class="num">${pad(i + 1)}</span><span class="title">${esc(s.title)}</span></a></li>`)
          .join("")}
        </ol>
      </nav>
    </header>`;

const sections = dossier.sections
  .map(
    (s, i) => `
    <section class="section" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
      <h2 class="section-title" id="${esc(s.id)}-title"><span class="num">${pad(i + 1)}</span>${esc(s.title)}</h2>
      <div class="section-body">${s.blocks.map(renderBlock).join("")}
      </div>
    </section>`
  )
  .join("");

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
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
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
  <a class="skip" href="#${esc(dossier.sections[0].id)}">Skip to ${esc(dossier.sections[0].title)}</a>
  <div class="sheet">${coverSheet}
    <main>${sections}
    </main>

    <footer class="footer">
      <p>End of file. Set from ${a(`${REPO}/blob/main/bio.json`, "bio.json")}, the same text I use on every profile.</p>
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
console.log(`built dist/index.html (${html.length} bytes, ${dossier.sections.length} sections, ${exhibitCount} exhibits)`);
