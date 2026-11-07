// Serves the hub from static assets. /learn/... is the Blossom Tutoring course site, a separate
// Worker (justincgriffiths/blossom-tutoring-lessons) reached over the BLOSSOM service binding.
// /marketing-101/ is the Marketing 101 lesson page (build-marketing.mjs).
// /fleet/... holds the visualization pages (live fleet state). Cloudflare Access gates them
// (bin/access-login.sh); the Worker also checks the Access token itself and fails closed.
// /archive/... is a static snapshot of the old research site (justingriffiths.info), unlinked and noindex.
// Everything else belonged to that site, so it 301s to the same path under /archive/.
import { verifyAccessJwt } from "./access.js";

const APEX = "justingriffiths.com";
const ARCHIVE_PREFIX = "/archive";
const HUB_PATHS = new Set(["/", "/index.html", "/style.css", "/favicon.svg", "/robots.txt"]);
export const GATED_PREFIX = "/fleet";
const STATE_PATH = `${GATED_PREFIX}/state.json`, STATE_KEY = "state.json";
const GATED_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }

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
      // Live fleet state: the mini writes it to KV (bin/fleet-kv.sh); only this gated branch reads it.
      if (url.pathname === STATE_PATH) {
        const state = env.FLEET_KV ? await env.FLEET_KV.get(STATE_KEY) : null;
        if (state === null) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
        return new Response(state, { headers: { ...GATED_HEADERS, "Content-Type": "application/json; charset=utf-8" } });
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
