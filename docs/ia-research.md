# IA research: what is on justingriffiths.com, and how others organize theirs

Input for the IA grill session (`/unblock grill`) on the site's structure and navigation. Facts only: no
structure is chosen here, and each open question lists options with what they do to the nav.

Gathered 2026-11-16 from `origin/main` at `5a9a7da`, open PR #136, and live requests to
`https://justingriffiths.com`. Sources: `README.md`, `src/chrome.mjs` (`NAV`), `src/worker.js` (routes and gates),
`bio.json` (`dossier.sections`), `build*.mjs`, `bin/site-build.sh`, `bin/fleet-build.sh`, `public/robots.txt`.

---

## 1. Inventory

**Visibility key**
- **public**: served to anyone and indexable.
- **public, noindex**: served to anyone, but carries `noindex` (meta tag or `X-Robots-Tag`) or is under `Disallow` in `robots.txt`.
- **sign-in**: behind Cloudflare Access. The Worker also checks the token and answers 404 without one.
- **unlinked**: no link to it from the nav, the hub or another site page (reachable only by URL).

**Nav today** (`src/chrome.mjs` `NAV`, in order): Home · Lab ▾ (Qwen, Fleet, Game, Flows) · Resume · Pedal Design ·
Marketing 101 · Archive. Plus the brand link (Justin Griffiths → `/`) and the header action "About me" (→ `/#about`).
Booking is a text link in the About section and the footer.

"Last commit" is `git log -1 --format=%cs` over the files that build the page (listed in the Notes column where
not obvious).

| # | Path | Title | What it holds | Visibility | In nav now | Last commit |
|---|---|---|---|---|---|---|
| 1 | `/` | Justin Griffiths | The hub: a dossier cover sheet (portrait, name, headline, Positions, Location), an index, then numbered sections from `bio.json` | public | Home, brand link | 2026-11-16 |
| 2 | `/#about` | About | `bio.long` prose plus the links list | public | "About me" header action | 2026-11-16 (`bio.json`) |
| 3 | `/#work` | Work | Pedal Performance (GM) and Pearmill (AI) entries, plus a logo strip (both logos placeholders, so not rendered) | public | none (hub section) | 2026-11-16 |
| 4 | `/#lab` | Lab | Two entries: Qwen rollout (Public) and Fleet (Sign-in required) | public | none (cover link "See what I'm building") | 2026-11-16 |
| 5 | `/#influences` | People I learn from | Two groups of names: Thinkers, Creators | public | none (hub section) | 2026-11-16 |
| 6 | `/#contact` | Contact | Book a call, GitHub, LinkedIn, Research (→ `/archive/`) | public | none (hub section) | 2026-11-16 |
| 7 | `/pedal-design/` | Justin Griffiths | The same hub, same `bio.json`, rendered in the Pedal Design System skin | public | Pedal Design | 2026-11-16 (`build.mjs`, `src/pedal-design.css`, `src/tokens.css`) |
| 8 | `/resume/` | Resume | Full titles, verbatim from LinkedIn, grouped by company (`bio.json` `resume`) | public | Resume; also hub cover "Full resume" | 2026-11-08 |
| 9 | `/marketing-101/` | Marketing 101 | One page, ten sessions: a marketing lesson in the Pedal night lane with diagrams | sign-in (Fleet Access app), noindex | Marketing 101 (top level) | 2026-11-08 |
| 10 | `/qwen/` | Qwen rollout | Chores moved from paid Claude calls to a local Qwen model: counts, dollars, ms; live data every 5 min | public | Lab ▸ Qwen; hub Lab section | 2026-11-16 |
| 11 | `/qwen/dashboard/` | Qwen model performance | Tabler dashboard of model-performance numbers | public, noindex, unlinked | none | 2026-11-16 |
| 12 | `/qwen/dashboard/writeups/<slug>/` (3 pages) | Fill a table from raw rows · Issue labels replayed through Qwen · Inbox triage: Qwen and Haiku on the same messages | One writeup per set of numbers; each ends in an unwritten Recommendation | public, noindex, unlinked (linked from the dashboard only) | none | 2026-11-10 |
| 13 | `/archive/` | Archive | Landing for the justingriffiths.info snapshot: 186 pages, read-only, and a collections list | public, noindex | Archive; hub Contact "Research" | 2026-11-08 (landing); snapshot 2026-11-07 |
| 14 | `/archive/research/` | Research \| Justin Griffiths | The old research site's home, with its own nav (JG, Research, Articles, Briefings, Chat) | public, noindex | via `/archive/` | 2026-11-07 |
| 15 | `/archive/research/articles/` | Articles | 115 pages | public, noindex | via `/archive/` | 2026-11-07 |
| 16 | `/archive/research/self-hosting/` | Self-hosting | 31 pages | public, noindex | via `/archive/` | 2026-11-07 |
| 17 | `/archive/research/microloans-ubi/` | Microloans and UBI | 31 pages | public, noindex | via `/archive/` | 2026-11-07 |
| 18 | `/archive/research/briefings/` | Briefings | 4 pages | public, noindex | via `/archive/` | 2026-11-07 |
| 19 | `/archive/research/diversity-business/` | Diversity in business | 1 page | public, noindex | via `/archive/` | 2026-11-07 |
| 20 | `/archive/research/epstein-govt-docs/` | Epstein government documents | 1 page | public, noindex | via `/archive/` | 2026-11-07 |
| 21 | `/archive/research/iran-conflict/` | Iran conflict | 1 page | public, noindex | via `/archive/` | 2026-11-07 |
| 22 | `/archive/research/sustainability-economics/` | Sustainability economics | 1 page | public, noindex | via `/archive/` | 2026-11-07 |
| 23 | `/learn/marketing/marketing-101/` | Marketing 101 · Marketing, read as an economist | Blossom Tutoring course: 5 lessons, a review, metric ladder, glossary, sources. Served by the separate `blossom` Worker | public, unlinked (no robots tag seen) | none | 2026-11-04 (repo `blossom-tutoring-lessons`) |
| 24 | `/cookbook/` | Family Cookbook | Family recipes by course, with a search box; pages live in KV, rendered from the private `recipes` repo | sign-in (own Access app, email code, family list), noindex, unlinked | none | 2026-11-16 |
| 25 | `/cookbook/<slug>/` | (recipe title) | One recipe: what to set out, steps, original text | sign-in, noindex, unlinked | none | 2026-11-16 |
| 26 | `/fleet/` | (Rune scene) | The fleet scene: battle school (client work) and the Bike Factory (agent infra) side by side, from live fleet state | sign-in | Lab ▸ Fleet; hub Lab section | 2026-11-07 (`fleet/src`) |
| 27 | `/fleet/battle-school/` | (Rune scene) | One army per client, toons per channel | sign-in, unlinked | none | 2026-11-07 |
| 28 | `/fleet/bike-factory/` | (Rune scene) | Bridges by repo, which bridgeman holds which card | sign-in, unlinked | none | 2026-11-07 |
| 29 | `/fleet/seats/` | (Rune scene) | Envelope flow between seats, latest state per card, what waits on Justin | sign-in, unlinked | none | 2026-11-07 |
| 30 | `/fleet/game/` | Qwen game · Justin Griffiths | Per-round report of the Qwen cost game | sign-in, noindex | Lab ▸ Game | 2026-11-08 |
| 31 | `/fleet/flows/` | (flow list) | List of Mermaid flow diagrams | sign-in, noindex | Lab ▸ Flows | 2026-11-07 |
| 32 | `/fleet/flows/card-to-merge/` | How a card moves from Justin's ask to merge | One flow, drawn | sign-in, noindex | via `/fleet/flows/` | 2026-11-07 |
| 33 | `/fleet/meta/` | Meta rollout | Per-client built / verified / live / first-hour delivery; clients anonymized | sign-in plus Justin-only allowlist, noindex, unlinked | none | 2026-11-08 |
| 34 | `/design-systems/` (PR #136, open) | Design systems · Justin Griffiths | Ten design systems (Pedal baseline, six public references, three original directions), each drawing the same campaign dashboard | public once merged; today the live URL 301s to `/archive/design-systems/` | none in the diff (PR body says "under Lab"; `NAV` and `bio.json` are not changed by the PR) | 2026-11-16 (branch `feat/design-systems`) |
| 35 | `/construction` | (construction page) | Under-construction page, shown for every path only when `CONSTRUCTION = true` in `src/worker.js` (now `false`) | dormant | none | 2026-11-08 |

**Counts**
- **Rows**: 35 (33 on main, 1 in PR #136, 1 dormant). Row 12 stands for 3 pages and row 25 for one page per recipe.
- **By visibility (rows)**: public and indexable 10 (rows 1–8, 10, 23: five distinct pages, `/`, `/pedal-design/`, `/resume/`, `/qwen/`, `/learn/…`, plus the five hub sections); public noindex 12 (archive ×10, Qwen dashboard ×2); sign-in 11 (fleet ×8, marketing-101, cookbook ×2); PR 1; dormant 1.
- **Nav entries pointing at sign-in pages**: 4 of 9 links (Marketing 101, Fleet, Game, Flows).

**Observations from the inventory**
- **Two Marketing 101s**: `/marketing-101/` (gated, ten sessions, Pedal night lane) and `/learn/marketing/marketing-101/` (public, Blossom course, six lessons) are different pages with the same name.
- **Hub as menu**: the hub's own Lab section lists 2 items (Qwen, Fleet); the nav's Lab group lists 4 (Qwen, Fleet, Game, Flows).
- **Same content, two skins**: `/` and `/pedal-design/` render the same `bio.json`.
- **Dead path inside the archive**: the snapshot's own nav links `/archive/chat`, which is not in the snapshot.
- **`/learn/` root**: answers 404; only the course path answers.
- **Unlinked but live**: `/qwen/dashboard/` (and writeups), `/learn/…`, `/cookbook/`, `/fleet/battle-school/`, `/fleet/bike-factory/`, `/fleet/seats/`, `/fleet/meta/`.

---

## 2. Thought-leader sites

Every site below was opened on 2026-11-16 (WebFetch; Paul Graham's image-map nav also read with `curl`, because
its labels are images). Labels are quoted as the page shows them.

| Person | URL opened | Top-level nav (verbatim) | How content types are separated | Home page first screen | Archives and old work | Now / Start here |
|---|---|---|---|---|---|---|
| Paul Graham | https://paulgraham.com/ | Image-map sidebar, no text labels. Targets in order: `articles.html` (Essays), Hackers & Painters (Amazon), `books.html`, Y Combinator, `arc.html`, `bel.html`, `lisp.html`, `antispam.html`, `kedrosky.html`, `faq.html`, `raq.html`, `quo.html`, `rss.html`, `bio.html`, Twitter, Mastodon, `ind.html`, `info.html` | One sidebar entry per type or project (essays, books, languages, FAQ, quotes, bio) | Name and a "New:" line linking the two newest essays; "Want to start a startup?" YC link | Essays: one flat list page (`articles.html`) | Neither |
| Patrick Collison | https://patrickcollison.com/ | About, Advice, Bookshelf, Culture, Dispatches, Fast, Growth, Labs, Links, Pollution, Progress, Questions, Solar, SV history, Travel | By topic: every nav item is a topic or list page; no writing / projects split | Name plus the nav list, nothing else | No archive or dates on the home page | Neither ("About" only) |
| Gwern Branwen | https://gwern.net/ | No menu bar. Intro line links: About page, Design page, about-me page, Changelog, blog posts, new links, subscribe, archives | Home page is a categorized index: "Newest", "Popular", "Newest: Blog", then ~40 topic headings (Statistics, Psychology, AI: Safety…) plus type headings (Docs, Reviews, Fiction: Prose, Fiction: Verse) | One-paragraph intro ("I write about AI, psychology, & statistics"), then Newest and Popular lists | Changelog, old newsletters (`/doc/newsletter/index`), browse by tag (`/doc/index`) | Neither; Changelog stands in for recency |
| Andy Matuschak | https://andymatuschak.org/ | Andy Matuschak, Email, X, Bsky | Home page sections by type: Projects: tools for thought · More work · Working notes · Letters from the lab · Projects: experimental ed-tech · Research Blog · More, misc, meta · Selected podcasts · Other writing | One-paragraph statement of current research focus and how it is funded | Old Khan Academy work kept as its own sections on the home page; working notes live on a separate site; some letters patron-only (lock icon) | Neither; the intro paragraph states current focus |
| Maggie Appleton | https://maggieappleton.com/ | Home, The Garden, Essays, Notes, Patterns, Smidgeons, Talks, Podcasts, Library, Now, About | By type, each type defined in one line (Essays: "Opinionated, longform narrative writing with an agenda"; Notes: "Loose, unopinionated notes…") | Tagline "Maggie makes visual essays about programming, design, and anthropology", short bio, a garden explainer | Type pages; Antilibrary linked from a home card only | Now in nav |
| Simon Willison | https://simonwillison.net/ | About, Newsletter, TILs, Tools, Atom feed; type tabs: Entries, Links, Quotes, Notes, Guides, Elsewhere; tag bar with counts (claude-code 135, security 645, llm 654…) | Single reverse-chronological stream of mixed types, filterable by type tab and by tag; TILs and Tools on subdomains | Site name, sponsor banner, then the stream from today | Year archive 2002–2026 in the footer; tag pages | Neither; sidebar "Highlights" |
| Derek Sivers | https://sive.rs/ | No nav bar: name and a search icon | Home page sections: me in 10 seconds · newest articles · my books · interviews · projects · tweets · photos · You want more?! · syndicated | "me in 10 seconds" career summary, then links "Me in 10 minutes?" (`/about`), "What am I doing now?" (`/now`), "Contact me" | "… and more here" links to `/blog`, `/d`; `/random` | `/now` on the first screen |
| Tiago Forte | https://fortelabs.com/ | Start Here, Free Resources ▾ (Blog, Videos, Podcast, Community), Books ▾ (Life in Perspective, Building a Second Brain, The PARA Method), Course, Tools, Join the Newsletter | By offer: free resources vs books vs course; writing sits inside "Free Resources" | New-book hero ("OUT NOW", tagline, order button) | Blog behind a dropdown; no archive in nav | Start Here in nav and on the page |
| Robin Sloan | https://www.robinsloan.com/ | Home, About, Moonbound | Home page lists grouped by type: Basics · Archives (Newsletter, Tech blog, Miscellaneous) · Novels · Novellas · Special projects · Short stories · Notable essays | Tagline "a creative industrialist", a paragraph naming the books, side businesses and newsletter | An "Archives" group on the home page for the three running streams; ★ marks recommended items | Neither; ★ marks act as picks |
| Matt Webb | https://interconnected.org/home/ | Interconnected, About, Archive | Single blog stream; tags; "Auto-calculated kinda related posts" | Latest post, with a sidebar (Subscribe, Unoffice Hours "Book a call", social links) | Year archive 2007–2026, "On this day", "Best of <year>" lists | "New? Start here:" → "Best of 2025" |

**Also opened, kept out of the main table**
- **Dan Luu** (https://danluu.com/): home page is one dated list of posts (public, then Patreon); footer row Archive, Patreon, Mastodon, Bluesky, Twitter, RSS. No categories.
- **Craig Mod** (https://craigmod.com/): nav About Craig, Books & Essays, Membership, Shop!; secondary row for podcasts and two newsletters; first screen is a newsletter sign-up and the latest book; home sections Published Essays, Popular Essays, Recent Essays.
- **Steph Ango** (https://stephango.com/): nav Steph Ango, About, Now; home sections Latest, Topics (~27 tags), Writing (full dated list back to 2012, which is the archive).
- **Julie Zhuo** (https://www.juliezhuo.com/): no nav; four role lines (Sundial, the book, the Substack, X) and "Select writing and talks", mostly links off-site.

**Fetched but unusable** (Substack served a subscribe interstitial, no nav or content): Lenny Rachitsky
(https://www.lennysnewsletter.com/), Ethan Mollick (https://www.oneusefulthing.org/). Not described.

---

## 3. Patterns

| Pattern | What it is | Sites that use it (of those opened) |
|---|---|---|
| By-type nav | Nav or home sections split by content type (essays, notes, talks, books, projects) | Appleton, Willison (tabs), Matuschak (sections), Sloan (sections), Paul Graham (sidebar), Sivers (sections) |
| By-topic nav | Nav or index split by subject | Collison (whole nav), Gwern (home index), Willison (tag bar), Steph Ango (Topics) |
| Single stream | One reverse-chronological feed is the home page | Willison, Webb, Dan Luu |
| Home page is the index | Everything listed on one long home page, little or no nav | Gwern, Matuschak, Sivers, Sloan, Collison |
| Minimal nav (≤ 4 items) | Name plus About / Archive / one feature | Matuschak, Sloan, Webb, Steph Ango, Dan Luu |
| /now | A page for what the person is doing now | Appleton, Sivers, Steph Ango |
| Start here | A named entry point for newcomers | Forte (nav), Webb ("New? Start here:") |
| Curated picks | Popular / Best of / starred lists | Gwern (Popular), Sloan (★), Webb (Best of), Craig Mod (Popular Essays), Willison (Highlights) |
| Year archive / changelog | Old work reached by year or by a change log | Willison, Webb, Gwern (Changelog) |
| Gated or paid content shown in place | Locked items listed alongside open ones, marked | Matuschak (lock icon), Dan Luu (Patreon block) |
| Offer-led nav | Nav built around what is sold or joined (book, course, newsletter) | Forte, Craig Mod |
| Booking in the chrome | A call-booking link in persistent chrome | Webb (sidebar "Book a call"); this site today (footer, About) |

---

## 4. Questions the grill must settle

Each has options and what each does to the nav. No option is marked as recommended.

1. **What is the site, first?**
   - **Person page**: the hub stays the product; everything else hangs off sections of it. Nav stays short (About, Work, Lab, Contact) and most pages become links from sections.
   - **Portfolio**: projects lead. Nav gains a Work / Projects index listing Qwen, Fleet, design systems, Marketing 101, Blossom as items.
   - **Publication**: writing leads. Nav centers on Writing / Notes / Archive, and the hub becomes About.
   - **Mixed, by type**: Appleton-style nav, one entry per content type.

2. **How are things grouped: by type, by topic, or by audience?**
   - **By type**: Projects, Writing, Lessons, Resume. Qwen and Fleet sit together; both Marketing 101s sit under Lessons.
   - **By topic**: AI agents, Marketing, Design, Research. Qwen, Fleet, Game, Flows under AI agents; Marketing 101 ×2 under Marketing; Pedal Design and design systems under Design.
   - **By audience**: Clients, Students, Family, Me. Nav splits by who the page is for (Marketing 101 and Blossom for students, cookbook for family, fleet for Justin).

3. **Where do sign-in pages live?** (11 rows; 4 of 9 nav links point at them today)
   - **In the public nav, marked**: as now ("Sign-in required" notes); public visitors meet login walls.
   - **One gated door**: a single "Private" or "Sign in" entry leads to an index of fleet, meta, cookbook, marketing-101. Public nav carries only public pages.
   - **Off the public nav entirely**: gated pages reachable by URL or a bookmark only.
   - **Shown locked in place**: Matuschak-style; listed with the public items, marked with a lock.

4. **Where does the Lab go, and what is in it?**
   - **Keep the Lab dropdown**: Qwen, Fleet, Game, Flows, plus `/design-systems/` (PR #136) makes 5.
   - **Lab as an index page**: one `/lab/` page lists every experiment (Qwen, Qwen dashboard, fleet pages, design systems) with status; nav has one Lab link.
   - **Fold into Work / Projects**: Lab stops being a separate group.

5. **What happens to `/pedal-design/`?**
   - **Keep as a top-level nav item**: as now.
   - **Move under Design** (with `/design-systems/`): the Pedal-skinned hub becomes one exhibit among design work.
   - **Drop from nav, keep the URL**: reachable from the design-systems page only.

6. **How do the two Marketing 101s relate?**
   - **Keep both, rename one**: nav shows two distinct names.
   - **One Lessons / Teaching section** listing both (and future Blossom courses); the gate decides who can open which.
   - **Link only the public one** (`/learn/…`); the gated one leaves the nav.

7. **How is the archive handled?** (186 pages, noindex, last taken 2026-11-07)
   - **Keep "Archive" in the top nav**: as now.
   - **Footer only**: Archive leaves the top nav, stays in the footer and Contact.
   - **Fold into a Writing / Research section**: the eight collections become a topic list there, marked as a snapshot.
   - **Curated picks plus the rest**: a "Best of" from the 186 pages leads, the full snapshot sits behind it.

8. **Is there a "now" or "start here" page?**
   - **/now**: one page for current focus (Pedal, Pearmill, fleet); nav gains Now.
   - **Start here**: a newcomer page that routes to the 3–5 things to see first.
   - **Neither**: the hub cover does that job.

9. **What does the home page's first screen do?**
   - **Dossier cover**: as now (portrait, name, headline, facts, index).
   - **Current focus**: a now-style statement plus links (Matuschak, Sivers).
   - **Newest work**: the latest item from each stream (Gwern, Willison).
   - **Index of everything**: one long home page and a short nav (Sloan, Sivers).

10. **What happens to unlinked live pages?** (`/qwen/dashboard/`, `/learn/…`, `/cookbook/`, `/fleet/battle-school/`, `/fleet/bike-factory/`, `/fleet/seats/`, `/fleet/meta/`)
    - **Link each from its parent** (`/qwen/` → dashboard; `/fleet/` → its three worlds; Lessons → Blossom).
    - **Leave unlinked by design**: listed here only.
    - **Decide per page**: the grill goes page by page.

11. **Is booking a call a nav item?**
    - **Header button or link**: booking joins the persistent chrome.
    - **As now**: About section and footer only (the header action is "About me").
    - **Contact page**: booking, GitHub, LinkedIn on one page in nav.

12. **How many top-level nav items?** (9 links today, including the 4 under Lab)
    - **3–4**: minimal (Matuschak, Sloan, Webb). Most pages move to index pages.
    - **5–7**: by type or by topic, with one dropdown at most.
    - **8+**: as now or larger, every major page in the nav (Appleton has 11).
