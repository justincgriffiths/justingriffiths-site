import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { verifyAccessJwt, resetKeyCache } from "../src/access.js";

const TEAM = "team.cloudflareaccess.com", AUD = "aud123";
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1" };
const certs = async () => new Response(JSON.stringify({ keys: [jwk] }));
async function token(over = {}, key = privateKey) {
  const h = enc({ alg: "RS256", kid: "k1" });
  const p = enc({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600, ...over });
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`))).toString("base64url");
  return `${h}.${p}.${sig}`;
}
const req = (t) => new Request("https://justingriffiths.com/fleet/", { headers: t ? { "Cf-Access-Jwt-Assertion": t } : {} });
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const v = (r, e = env) => { resetKeyCache(); return verifyAccessJwt(r, e, certs); };

test("valid token passes", async () => assert.equal(await v(req(await token())), true));
test("no token fails", async () => assert.equal(await v(req()), false));
test("wrong audience fails", async () => assert.equal(await v(req(await token({ aud: ["other"] }))), false));
test("wrong issuer fails", async () => assert.equal(await v(req(await token({ iss: "https://evil.example" }))), false));
test("expired fails", async () => assert.equal(await v(req(await token({ exp: 1 }))), false));
test("forged signature fails", async () => {
  const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"]);
  assert.equal(await v(req(await token({}, other.privateKey))), false);
});
test("alg none fails", async () => {
  const t = `${enc({ alg: "none", kid: "k1" })}.${enc({ aud: [AUD], iss: `https://${TEAM}`, exp: 9e9 })}.x`;
  assert.equal(await v(req(t)), false);
});
test("unset config fails closed", async () => assert.equal(await v(req(await token()), {}), false));

const assets = { fetch: async () => new Response("scene") };
const hit = (path, headers) => worker.fetch(new Request(`https://justingriffiths.com${path}`, { headers }), { ASSETS: assets, ...env });
test("worker: /fleet/ without token is 404, not a redirect to .info", async () => {
  assert.equal((await hit("/fleet/")).status, 404);
  assert.equal((await hit("/fleet/scene.js")).status, 404);
});
test("worker: other unknown paths still 301 to .info", async () => {
  const r = await hit("/research");
  assert.equal(r.status, 301);
  assert.match(r.headers.get("location"), /justingriffiths\.info/);
});
test("worker: hub stays public", async () => assert.equal((await hit("/")).status, 200));
test("worker: gated response is private, no-store, framing denied", async () => {
  const t = await token();
  resetKeyCache();
  const realFetch = globalThis.fetch; globalThis.fetch = certs;
  try {
    const r = await hit("/fleet/", { "Cf-Access-Jwt-Assertion": t });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
  } finally { globalThis.fetch = realFetch; }
});
