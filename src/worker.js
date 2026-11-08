// Serves the hub from static assets. /learn/... is the Blossom Tutoring course site, a separate
// Worker (justincgriffiths/blossom-tutoring-lessons) reached over the BLOSSOM service binding.
// /marketing-101/ is the Marketing 101 lesson page (build-marketing.mjs).
// /pedal-design/ is the same hub in the Pedal Design System (build.mjs), public like /.
// /qwen/data.json comes from KV (bin/qwen-kv.sh), falling back to the built asset.
// /fleet/... holds the visualization pages (live fleet state). Cloudflare Access gates them
// (bin/access-login.sh); the Worker also checks the Access token itself and fails closed.
// /archive/... is a static snapshot of the old research site (justingriffiths.info), unlinked and noindex.
// Everything else belonged to that site, so it 301s to the same path under /archive/.
import { verifyAccessJwt } from "./access.js";

const APEX = "justingriffiths.com";
// true: every .com path except /fleet, /media and /qwen answers with public/construction.html (site#56;
// /qwen stays live by Justin's call, 2026-11-08).
// false puts .com back on the full site. The full site stays on the workers.dev staging host either way.
const CONSTRUCTION = false;
const ARCHIVE_PREFIX = "/archive";
const HUB_PATHS = new Set(["/", "/index.html", "/site.css", "/style.css", "/favicon.svg", "/robots.txt"]);
const GATED_PREFIX = "/fleet";
const META_PREFIX = `${GATED_PREFIX}/meta`, META_STATE_PATH = `${META_PREFIX}/state.json`, META_KEY = "meta.json";
const STATE_PATH = `${GATED_PREFIX}/state.json`, STATE_KEY = "state.json";
const GAME_STATE_PATH = `${GATED_PREFIX}/game/state.json`, GAME_KEY = "game/state.json";
const QWEN_DATA_PATH = "/qwen/data.json", QWEN_KEY = "qwen/data.json";
const GATED_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" };

// The token was already verified; this reads its email claim and checks the allowlist. Fails closed.
async function metaAllowed(request, env) {
  const allow = (env.META_ALLOWLIST || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  try {
    const p = request.headers.get("Cf-Access-Jwt-Assertion").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const email = String(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0)))).email || "").toLowerCase();
    return !!email && allow.includes(email);
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }

    if (CONSTRUCTION && url.hostname === APEX && url.pathname !== GATED_PREFIX && !url.pathname.startsWith(`${GATED_PREFIX}/`) && url.pathname !== "/media" && !url.pathname.startsWith("/media/") && url.pathname !== "/qwen" && !url.pathname.startsWith("/qwen/")) {
      const res = await env.ASSETS.fetch(new Request(new URL("/construction", url), request));
      return new Response(res.body, { status: res.status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    }

    // Staging (any host but the apex): noindex every page. HTML gets the meta tag, everything gets the header.
    if (url.hostname !== APEX) {
      const res = await this.route(request, env, url);
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex, nofollow");
      if (!(out.headers.get("Content-Type") || "").includes("text/html") || res.status !== 200) return out;
      const html = (await out.text()).replace("</head>", '<meta name="robots" content="noindex"></head>');
      out.headers.delete("Content-Length");
      return new Response(html, out);
    }
    return this.route(request, env, url);
  },

  async route(request, env, url) {
    if (url.pathname === "/learn" || url.pathname.startsWith("/learn/")) {
      return env.BLOSSOM.fetch(request);
    }

    // Gated pages: only a request carrying a valid Access token for this app gets through.
    // Access injects the token at the edge; a request that skipped Access (workers.dev, a
    // misconfigured app) has none, so it gets a 404, not the page.
    if (url.pathname === GATED_PREFIX || url.pathname.startsWith(`${GATED_PREFIX}/`)) {
      if (!(await verifyAccessJwt(request, env))) return new Response("Not found", { status: 404 });
      if (url.pathname === GATED_PREFIX) {
        url.pathname = `${GATED_PREFIX}/`;
        return Response.redirect(url.toString(), 301);
      }
      // /fleet/meta/ is Justin-only: the Access token's email must be in the META_ALLOWLIST secret
      // (comma-separated). Unset means nobody. Anyone else gets the same 404 as no token.
      if (url.pathname === META_PREFIX || url.pathname.startsWith(`${META_PREFIX}/`)) {
        if (!(await metaAllowed(request, env))) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
        if (url.pathname === META_PREFIX) {
          url.pathname = `${META_PREFIX}/`;
          return Response.redirect(url.toString(), 301);
        }
        if (url.pathname === META_STATE_PATH) {
          const meta = env.FLEET_KV ? await env.FLEET_KV.get(META_KEY) : null;
          if (meta === null) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
          return new Response(meta, { headers: { ...GATED_HEADERS, "Content-Type": "application/json; charset=utf-8" } });
        }
      }
      // Live fleet state: the mini writes it to KV (bin/fleet-kv.sh); only this gated branch reads it.
      if (url.pathname === STATE_PATH) {
        const state = env.FLEET_KV ? await env.FLEET_KV.get(STATE_KEY) : null;
        if (state === null) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
        return new Response(state, { headers: { ...GATED_HEADERS, "Content-Type": "application/json; charset=utf-8" } });
      }
      // Qwen game report (bin/game-kv.sh writes it). Same gate as the fleet state; no key means 404.
      if (url.pathname === GAME_STATE_PATH) {
        const game = env.FLEET_KV ? await env.FLEET_KV.get(GAME_KEY) : null;
        if (game === null) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
        return new Response(game, { headers: { ...GATED_HEADERS, "Content-Type": "application/json; charset=utf-8" } });
      }
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(GATED_HEADERS)) out.headers.set(k, v);
      return out;
    }

    // /marketing-101/ is the Marketing 101 lesson, served from dist/marketing-101/.
    if (url.pathname === "/marketing-101") {
      url.pathname = "/marketing-101/";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/marketing-101/" || url.pathname === "/marketing-101/index.html") {
      return env.ASSETS.fetch(request);
    }

    // /resume/ is the full-titles resume, served from dist/resume/.
    if (url.pathname === "/resume") {
      url.pathname = "/resume/";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/resume/" || url.pathname === "/resume/index.html") {
      return env.ASSETS.fetch(request);
    }

    // /pedal-design/ is the hub in the Pedal Design System, served from dist/pedal-design/.
    if (url.pathname === "/pedal-design") {
      url.pathname = "/pedal-design/";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/pedal-design/" || url.pathname === "/pedal-design/index.html" || url.pathname === "/pedal-design/style.css" || url.pathname === "/pedal-design/site.css") {
      return env.ASSETS.fetch(request);
    }

    // /qwen/ is the public Qwen rollout page (aggregates only), served from dist/qwen/.
    if (url.pathname === "/qwen") {
      url.pathname = "/qwen/";
      return Response.redirect(url.toString(), 301);
    }
    // /qwen/data.json is live: bin/qwen-kv.sh puts the aggregates in KV every 10 minutes (1-hour TTL). Public, no Access;
    // only the leakchecked aggregates ever reach that key. A missing key, an expired one or a KV error falls back to the
    // built asset, so the page never goes dark.
    if (url.pathname === QWEN_DATA_PATH) {
      let live = null;
      try { live = env.FLEET_KV ? await env.FLEET_KV.get(QWEN_KEY) : null; } catch { live = null; }
      if (live !== null) return new Response(live, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === "/qwen/" || url.pathname === "/qwen/index.html") {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === ARCHIVE_PREFIX || url.pathname.startsWith(`${ARCHIVE_PREFIX}/`)) {
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex, nofollow");
      return out;
    }

    if (!HUB_PATHS.has(url.pathname)) {
      return Response.redirect(`${url.origin}${ARCHIVE_PREFIX}${url.pathname}${url.search}`, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
