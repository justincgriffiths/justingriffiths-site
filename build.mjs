// Renders dist/index.html from bio.json. No dependencies: `node build.mjs`.
//
// The page is a dossier: a cover sheet, an index, then numbered sections. Everything
// the page shows comes from bio.json. `bio.dossier` says what goes where; the canonical
// text (name, headline, bios, work, links, people) stays in the top-level keys, and
// blocks point at it with `from`. The block types are documented in the README.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, cpSync } from "node:fs";
import { quietCta } from "./src/quiet-cta.mjs";
import { chromeHead, siteHeader, bookLink, NAV_SCRIPT, ICON } from "./src/chrome.mjs";

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
// Frame classes (src/frame.css) go on the hub only; /pedal-design/ shares this renderer and keeps its own layout.
let currentSkin = "classic";
const F = (cls) => (currentSkin === "classic" ? cls : "");
// The cover lede is one sentence per line, so a job title never breaks across two (Justin,
// 2026-11-08: "Sr." alone at the end of a line on mobile). "Sr." is not a sentence end, and
// it stays glued to the next word.
const ledeLines = (text) => text.split(/(?<!\b(?:Sr|Jr|Dr|Mr|Ms|St)\.)(?<=\.)\s+(?=[A-Z])/)
  .map((s) => `<span class="lede-line">${esc(s).replace(/\b(Sr|Jr|Dr)\. /g, "$1.&nbsp;")}</span>`).join(" ");

const facts = (rows) => `
        <dl class="facts${F(" cq")}">${rows
          .map((r) => `
          <div class="fact${F(" rows-item")}"><dt>${esc(r.label)}</dt><dd>${factValue(r.from ? get(r.from) : r)}</dd></div>`)
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
  facts: (b) => facts(items(b).filter((x) => !(b.omit ?? []).includes(x.label))),
  // Plain text links (src/quiet-cta.mjs): the quietest way to offer an action (site#67). `only` picks labels.
  "quiet-links": (b) => `
        <p class="quiet-links">${items(b)
          .filter((l) => !b.only || b.only.includes(l.label))
          .map((l) => quietCta(l.url, l.label, { external: !l.url.startsWith("/") }))
          .join("")}</p>`,
  entries: (b) => `
        <ul class="entries">${items(b)
          .map((e) => `
          <li class="entry">
            <div class="entry-head${F(" cluster")}">${e.url ? a(e.url, esc(e.name), "name") : `<span class="name">${esc(e.name)}</span>`}${
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
        <div class="exhibits${F(" grid")}">${items(b).map((x) => exhibit(x)).join("")}
        </div>`,
  // Only real logos render. A placeholder (or an item with no src) is skipped, and a strip with
  // nothing real in it renders nothing at all: no "logo pending" tiles on a live page (site#51).
  logos: (b) => {
    const real = items(b).filter((l) => l.src && !l.placeholder);
    if (!real.length) return "";
    return `
        <ul class="logos${F(" cluster")}" aria-label="${esc(b.label ?? "Organizations")}">${real
          .map((l) => {
            const mark = `<img src="${esc(l.src)}" alt="${esc(l.name)}" loading="lazy">`;
            return `
          <li>${l.url ? a(l.url, mark) : mark}</li>`;
          })
          .join("")}
        </ul>`;
  },
};
const renderBlock = (b) => {
  const fn = blocks[b.type];
  if (!fn) throw new Error(`bio.json: unknown block type "${b.type}"`);
  return fn(b);
};

// The same dossier renders on two pages, both on the shared chrome (src/chrome.mjs) and /site.css:
// the hub at / (src/style.css) and /pedal-design/ (public/pedal.css). One bio.json, one renderer.
// Dark only since 2026-11-08 (Justin): the Light | Night switch is gone; both pages are the night lane.
const SKINS = {
  classic: { path: "/", site: "/site.css", css: "/style.css", current: "home" },
  pedal: { path: "/pedal-design/", site: "/pedal-design/site.css", css: "/pedal-design/style.css", current: "pedal-design" },
};

// The hero visual: a DS card holding a picture. bio.json can set dossier.cover.visual ({ src, alt, caption }).
// Until it does the hero shows no mark and no slot: the big JG logo is gone (site#67).
const coverVisual = (v) => {
  if (!v?.src) return "";
  const note = v.caption ? `<figcaption class="visual-note">${esc(v.caption)}</figcaption>` : "";
  return `
        <figure class="cover-visual${F(" fit")}">
          <div class="visual-card"><div class="visual-art"><img src="${esc(v.src)}" alt="${esc(v.alt ?? "")}" loading="eager" decoding="async"></div></div>${note}
        </figure>`;
};

function renderPage(skin) {
  currentSkin = skin;
  exhibitCount = 0;
  const updated = new Date().toISOString().slice(0, 10);
  const { cover = {} } = dossier;
  const labId = dossier.sections.find((s) => s.id === "lab") ? "lab" : null;

  const coverSheet = `
      <section class="cover" aria-labelledby="subject">
        <div class="cover-body${F(" band switcher")}">
          ${cover.portrait ? exhibit(cover.portrait, "portrait") : ""}
          <div class="cover-id">
            <h1 id="subject"${F(' class="t-display"')}>${esc(bio.name)}</h1>
            ${cover.lede ? `<p class="lede${F(" fit")}">${ledeLines(get(cover.lede))}</p>` : ""}
            <div class="cover-actions${F(" cluster")}">
              ${labId ? `<a class="cover-more" href="#${labId}">See what I am building${ICON.arrow}</a>` : ""}
            </div>
            ${cover.facts ? facts(cover.facts) : ""}
          </div>${cover.portrait ? "" : coverVisual(cover.visual)}
        </div>
        <nav class="index${F(" band")}" aria-label="Contents">
          <h2 class="kicker${F(" sr-only")}">Index</h2>
          <ol${F(' class="cluster"')}>${dossier.sections
            .map((s, i) => `
            <li><a href="#${esc(s.id)}"><span class="num">${pad(i + 1)}</span><span class="title">${esc(s.title)}</span></a></li>`)
            .join("")}
          </ol>
        </nav>
      </section>`;

  const sections = dossier.sections
    .map(
      (s, i) => `
      <section class="section${F(" band sidebar sidebar-sticky")}" id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">
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
    <link rel="canonical" href="https://justingriffiths.com${SKINS[skin].path}">
    <meta property="og:title" content="${esc(bio.name)}">
    <meta property="og:description" content="${esc(bio.headline)}">
    <meta property="og:url" content="https://justingriffiths.com${SKINS[skin].path}">
    <meta property="og:type" content="profile">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    ${chromeHead(SKINS[skin].site)}
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: bio.name,
      url: "https://justingriffiths.com",
      jobTitle: bio.work.map((w) => `${w.role}, ${w.name}`),
      homeLocation: bio.location,
      sameAs: bio.links.filter((l) => l.url.startsWith("https://") && !l.url.includes("justingriffiths.com")).map((l) => l.url),
    }).replace(/</g, "\\u003c")}</script>
    <link rel="stylesheet" href="${SKINS[skin].css}">
  </head>
  <body class="skin-${skin}">
    <a class="skip" href="#main">Skip to content</a>
    ${siteHeader(SKINS[skin].current)}
    <main id="main" class="sheet">${coverSheet}${sections}
    </main>

    <footer class="footer${F(" band cluster")}">
      <p>Set from ${a(`${REPO}/blob/main/bio.json`, "bio.json")}, the same text I use on every profile. Updated <time datetime="${updated}">${updated}</time>.</p>
      ${bookLink()}
    </footer>
    ${NAV_SCRIPT}
  </body>
  </html>
  `;
  return html;
}

const classicHtml = renderPage("classic");
const pedalHtml = renderPage("pedal");
const html = classicHtml;

mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/index.html", import.meta.url), classicHtml);
mkdirSync(new URL("./dist/pedal-design/", import.meta.url), { recursive: true });
writeFileSync(new URL("./dist/pedal-design/index.html", import.meta.url), pedalHtml);
copyFileSync(new URL("./src/pedal-design.css", import.meta.url), new URL("./dist/pedal-design/style.css", import.meta.url));
// /site.css is Shallan (src/shallan.css) plus the shared chrome and the frame (src/frame.css); every personal page loads it.
// /pedal-design/site.css is the Pedal DS (src/tokens.css) plus the same chrome and frame. /style.css is the hub's own rules.
const frameCss = readFileSync(new URL("./src/frame.css", import.meta.url), "utf8");
const chromeCss = readFileSync(new URL("./src/chrome.css", import.meta.url), "utf8");
const shallanCss = readFileSync(new URL("./src/shallan.css", import.meta.url), "utf8");
writeFileSync(new URL("./dist/site.css", import.meta.url), [shallanCss, chromeCss, frameCss].join("\n"));
writeFileSync(
  new URL("./dist/pedal-design/site.css", import.meta.url),
  [readFileSync(new URL("./src/tokens.css", import.meta.url), "utf8"), chromeCss, frameCss].join("\n")
);
// The Claude Design preview cards link a sibling copy of Shallan, so the folder pushes on its own.
mkdirSync(new URL("./design/shallan/", import.meta.url), { recursive: true });
writeFileSync(new URL("./design/shallan/shallan.css", import.meta.url), shallanCss);
copyFileSync(new URL("./src/style.css", import.meta.url), new URL("./dist/style.css", import.meta.url));
for (const f of ["favicon.svg", "robots.txt", "construction.html"]) {
  const src = new URL(`./public/${f}`, import.meta.url);
  if (existsSync(src)) copyFileSync(src, new URL(`./dist/${f}`, import.meta.url));
}
// The .info snapshot at /archive/ (bin/archive-snap.mjs). Unlinked, so it is only copied, never indexed.
if (existsSync(new URL("./archive/", import.meta.url))) {
  cpSync(new URL("./archive/", import.meta.url), new URL("./dist/archive/", import.meta.url), { recursive: true });
}
console.log(`built dist/index.html (${html.length} bytes, ${dossier.sections.length} sections, ${exhibitCount} exhibits)`);

// The /archive/ landing, after the snapshot copy above (see build-archive.mjs).
await import("./build-archive.mjs");

// The Marketing 101 lesson at /marketing-101/ (see build-marketing.mjs).
await import("./build-marketing.mjs");

// The Qwen rollout page at /qwen/ (see build-qwen.mjs; data from bin/qwen-state.sh).
await import("./build-qwen.mjs");
