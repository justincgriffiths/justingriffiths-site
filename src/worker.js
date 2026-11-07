// Serves the hub from static assets. /learn/... is the Blossom Tutoring course site, a separate
// Worker (justincgriffiths/blossom-tutoring-lessons) reached over the BLOSSOM service binding.
// /marketing-101/ is the Marketing 101 lesson page (build-marketing.mjs).
// /fleet/... holds the visualization pages (live fleet state). Cloudflare Access gates them
// (bin/access-login.sh); the Worker also checks the Access token itself and fails closed.
// Everything else belonged to the old research site, so it 301s to the same path on justingriffiths.info.
import { verifyAccessJwt } from "./access.js";

const APEX = "justingriffiths.com";
const RESEARCH = "https://justingriffiths.info";
const HUB_PATHS = new Set(["/", "/index.html", "/style.css", "/favicon.svg", "/robots.txt"]);
export const GATED_PREFIX = "/fleet";

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
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("Cache-Control", "private, no-store");
      out.headers.set("X-Content-Type-Options", "nosniff");
      out.headers.set("X-Frame-Options", "DENY");
      out.headers.set("Referrer-Policy", "no-referrer");
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

    if (!HUB_PATHS.has(url.pathname)) {
      return Response.redirect(`${RESEARCH}${url.pathname}${url.search}`, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
