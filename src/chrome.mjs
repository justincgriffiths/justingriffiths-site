// The site chrome every page shares (site#51): the <head> links, the sticky header with the site nav and
// the one primary action (Book a call), and the small script that drives the menu. Pattern from
// pedal-performance.com (pearmill/pedal-agency index.html + css/styles.css §4): links, then a primary
// button on the right; below 1024px the links fold into a menu button.
// Styles are src/chrome.css, shipped with src/shallan.css as /site.css (personal pages) and with
// src/tokens.css as /pedal-design/site.css (the Pedal DS page).

export const BOOK_URL = "https://cal.com/justin-griffiths";

// key: what a page passes as `current`. Lab is a group; its key marks the group when a child is current.
export const NAV = [
  { key: "home", href: "/", label: "Home" },
  {
    key: "lab",
    label: "Lab",
    items: [
      { key: "qwen", href: "/qwen/", label: "Qwen", note: "Moving chores onto a local model" },
      { key: "fleet", href: "/fleet/", label: "Fleet", note: "The agent fleet, live. Sign-in required" },
      { key: "flows", href: "/fleet/flows/", label: "Flows", note: "How work moves through it. Sign-in required" },
    ],
  },
  { key: "pedal-design", href: "/pedal-design/", label: "Pedal Design" },
  { key: "marketing-101", href: "/marketing-101/", label: "Marketing 101" },
  { key: "archive", href: "/archive/", label: "Archive" },
];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Drawn icons (one 2px stroke, round caps), not glyphs.
const ICON = {
  chevron: `<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  menu: `<svg class="icon icon-menu" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  close: `<svg class="icon icon-close" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  arrow: `<svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
export { ICON };

// Fonts, the shared stylesheet, and the class that tells the CSS the menu script will run.
export const chromeHead = (sheet = "/site.css") => `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${sheet}">
    <meta name="color-scheme" content="dark">
    <script>document.documentElement.classList.add("js")</script>`;

export const bookButton = (cls = "", label = "Book a call") =>
  `<a class="btn btn-primary${cls ? ` ${cls}` : ""}" href="${BOOK_URL}" rel="noopener">${esc(label)}</a>`;

const link = (item, current) =>
  `<a href="${esc(item.href)}"${item.key === current ? ' aria-current="page"' : ""}>${esc(item.label)}</a>`;

// One nav, two layouts. At 1024px and up: a row, with Lab as a dropdown (a button with aria-expanded).
// Below 1024px: the menu button opens a panel with every link stacked and Lab's pages listed under it.
// With scripts off, the panel is simply shown under the header, so every link still works.
export function siteHeader(current = "") {
  const items = NAV.map((item) => {
    if (!item.items) return `<li class="nav-item">${link(item, current)}</li>`;
    const inGroup = item.items.some((c) => c.key === current);
    return `<li class="nav-item nav-group${inGroup ? " is-current" : ""}">
          <button type="button" class="nav-group-toggle" aria-expanded="false" aria-controls="nav-${item.key}">${esc(item.label)}${ICON.chevron}</button>
          <span class="nav-group-label">${esc(item.label)}</span>
          <ul class="nav-sub" id="nav-${item.key}">${item.items
            .map((c) => `
            <li><a href="${esc(c.href)}"${c.key === current ? ' aria-current="page"' : ""}><span class="nav-sub-title">${esc(c.label)}</span><span class="nav-sub-note">${esc(c.note)}</span></a></li>`)
            .join("")}
          </ul>
        </li>`;
  }).join("\n        ");
  return `<header class="site-header">
    <div class="site-header-in">
      <a class="brand" href="/"${current === "home" ? ' aria-current="page"' : ""}>Justin Griffiths</a>
      <nav class="site-nav" id="site-nav" aria-label="Site">
        <ul class="nav-list">
        ${items}
        </ul>
      </nav>
      <div class="header-actions">
        ${bookButton("btn-sm header-cta")}
        <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav"><span class="sr-only">Menu</span>${ICON.menu}${ICON.close}</button>
      </div>
    </div>
  </header>`;
}

// Opens and closes the menu and the Lab dropdown. Escape or a click outside closes both.
export const NAV_SCRIPT = `<script>(function(){
var h=document.querySelector(".site-header");if(!h)return;
var t=h.querySelector(".nav-toggle"),g=h.querySelectorAll(".nav-group-toggle");
function set(b,o){b.setAttribute("aria-expanded",o?"true":"false")}
function closeGroups(x){for(var i=0;i<g.length;i++)if(g[i]!==x)set(g[i],false)}
function menu(o){set(t,o);h.classList.toggle("is-open",o);document.documentElement.classList.toggle("menu-open",o)}
t.addEventListener("click",function(){menu(t.getAttribute("aria-expanded")!=="true")});
for(var i=0;i<g.length;i++)g[i].addEventListener("click",function(e){var b=e.currentTarget;closeGroups(b);set(b,b.getAttribute("aria-expanded")!=="true")});
document.addEventListener("click",function(e){if(!e.target.closest(".nav-group"))closeGroups()});
document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;var open=h.querySelector(".nav-group-toggle[aria-expanded=true]");closeGroups();if(open)open.focus();else if(t.getAttribute("aria-expanded")==="true"){menu(false);t.focus()}});
matchMedia("(min-width: 1024px)").addEventListener("change",function(m){if(m.matches)menu(false)});
})()</script>`;
