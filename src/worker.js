// Serves the hub from static assets. Everything that isn't the hub belonged to the
// old research site, so it 301s to the same path on justingriffiths.info.
const APEX = "justingriffiths.com";
const RESEARCH = "https://justingriffiths.info";
const HUB_PATHS = new Set(["/", "/index.html", "/style.css", "/favicon.svg", "/robots.txt"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }

    if (!HUB_PATHS.has(url.pathname)) {
      return Response.redirect(`${RESEARCH}${url.pathname}${url.search}`, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
