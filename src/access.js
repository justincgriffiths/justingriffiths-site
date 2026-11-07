// Verifies the Cloudflare Access token (Cf-Access-Jwt-Assertion): RS256 signature against the
// team's published keys, then audience, issuer and expiry. Fails closed: no config, no token,
// a bad token or an unreachable key set all return false.
// Config (plain vars in wrangler.jsonc, not secrets): ACCESS_TEAM_DOMAIN (e.g. "team.cloudflareaccess.com"),
// ACCESS_AUD (the Access app's audience tag).
const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64(s)));

let keyCache = { at: 0, keys: [] };
async function signingKeys(team, fetchImpl, force = false) {
  if (!force && Date.now() - keyCache.at < 3600_000 && keyCache.keys.length) return keyCache.keys;
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("certs");
  const { keys } = await res.json();
  keyCache = { at: Date.now(), keys };
  return keys;
}
export const resetKeyCache = () => (keyCache = { at: 0, keys: [] });

export async function verifyAccessJwt(request, env, fetchImpl = fetch) {
  const team = env.ACCESS_TEAM_DOMAIN, aud = env.ACCESS_AUD;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!team || !aud || !token) return false;
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return false;
    const header = json(h), claims = json(p);
    if (header.alg !== "RS256") return false;
    let jwk = (await signingKeys(team, fetchImpl)).find((k) => k.kid === header.kid);
    // Unknown key id: Access may have rotated keys. Refetch once, but no more than once a minute.
    if (!jwk && Date.now() - keyCache.at > 60_000) jwk = (await signingKeys(team, fetchImpl, true)).find((k) => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return false;
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return auds.includes(aud) && claims.iss === `https://${team}` && typeof claims.exp === "number" && claims.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
