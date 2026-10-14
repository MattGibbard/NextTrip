// The owner's stats page: only reachable with a valid Cloudflare Access token, and counts leave out family 1.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { migrate } from "../worker/migrate";
import { sqliteD1 } from "./sqliteD1";

const TEAM = "somewhere.cloudflareaccess.com";
const AUD = "stats-audience-tag";
const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1", ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as Env;
const ctx = {} as ExecutionContext;

let keys: CryptoKeyPair;
let publicJwk: JsonWebKey;

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(claims: Record<string, unknown> = {}, signer = keys.privateKey) {
  const head = b64url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
  const body = b64url(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600, email: "owner@example.com", ...claims }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

function stubCloudflare() {
  vi.stubGlobal("fetch", async (url: string) => {
    if (url === `https://${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: [{ ...publicJwk, kid: "k1" }] });
    if (url === "https://api.cloudflare.com/client/v4/graphql") {
      const today = new Date().toISOString().slice(0, 10);
      return Response.json({
        data: {
          viewer: {
            accounts: [
              {
                daily: [{ count: 9, sum: { visits: 7 }, dimensions: { date: today } }],
                pages: [{ count: 9, dimensions: { requestPath: "/destinations/<lapland>" } }],
                referrers: [
                  { sum: { visits: 3 }, dimensions: { refererHost: "www.facebook.com" } },
                  { sum: { visits: 0 }, dimensions: { refererHost: "somewhere.party" } },
                ],
                countries: [{ sum: { visits: 7 }, dimensions: { countryName: "GB" } }],
              },
            ],
          },
        },
        errors: null,
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function stats(headers: Record<string, string> = {}, e: Env = env, path = "/stats") {
  return worker.fetch(new Request(`https://somewhere.party${path}`, { headers }), e, ctx);
}

async function api(cookie: string | null, method: string, path: string, json?: unknown) {
  const res = await worker.fetch(
    new Request(`https://somewhere.party/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: json === undefined ? undefined : JSON.stringify(json),
    }),
    env,
    ctx,
  );
  return { body: (await res.json()) as Record<string, string>, setCookie: res.headers.get("Set-Cookie") };
}

beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);

  // One family signs up and adds an idea; family 1 (the owner's own) has an idea too, which mustn't count.
  const { body } = await api(null, "POST", "/auth/email", { email: "family@example.com" });
  const token = new URL(body.dev_link).searchParams.get("token");
  const cookie = (await api(null, "POST", "/auth/verify", { token })).setCookie!.split(";")[0];
  await api(cookie, "POST", "/people", { name: "Sam" });
  await api(cookie, "POST", "/ideas", { title: "Lapland", places: [] });
  await env.DB.prepare("INSERT INTO ideas (title, family_id) VALUES ('Owner idea', 1)").run();
});

afterEach(() => vi.unstubAllGlobals());

it("is not found without a valid Access token", async () => {
  stubCloudflare();
  expect((await stats()).status).toBe(404);
  expect((await stats({ "Cf-Access-Jwt-Assertion": "not.a.token" })).status).toBe(404);
  expect((await stats({ "Cf-Access-Jwt-Assertion": await accessToken({ aud: ["another-app"] }) })).status).toBe(404);
  expect((await stats({ "Cf-Access-Jwt-Assertion": await accessToken({ exp: 1 }) })).status).toBe(404);
  const other = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  expect((await stats({ "Cf-Access-Jwt-Assertion": await accessToken({}, other.privateKey) })).status).toBe(404);
});

it("stays hidden until the Access settings are on the Worker", async () => {
  stubCloudflare();
  const res = await stats({ "Cf-Access-Jwt-Assertion": await accessToken() }, { ...env, ACCESS_AUD: undefined });
  expect(res.status).toBe(404);
});

it("shows the numbers, leaving out family 1", async () => {
  stubCloudflare();
  const res = await stats({ "Cf-Access-Jwt-Assertion": await accessToken() }, { ...env, CF_ANALYTICS_TOKEN: "t", CF_ACCOUNT_ID: "a" }, "/stats?days=7");
  expect(res.status).toBe(200);
  expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  const html = await res.text();
  expect(html).toContain('aria-current="page">7 days');
  expect(html).toMatch(/Families<\/span><b>1<\/b><span class="recent up">\+1/);
  expect(html).toMatch(/People<\/span><b>1<\/b><span class="recent up">\+1/);
  expect(html).toMatch(/Ideas<\/span><b>1<\/b>/);
  expect(html).toContain("&#60;lapland&#62;");
  expect(html).toContain("facebook.com");
  expect(html).not.toContain(">somewhere.party<");
  expect(html).toContain("United Kingdom");
});

it("still shows the site's numbers when page visits aren't connected", async () => {
  stubCloudflare();
  const html = await (await stats({ "Cf-Access-Jwt-Assertion": await accessToken() })).text();
  expect(html).toContain("Page visits aren't connected yet");
  expect(html).toContain("New families");
});

it("dates people who were already there to the day before join dates began", async () => {
  const db = sqliteD1();
  const before = (await import("../worker/migrate")).MIGRATIONS.filter((m) => m.name < "0019");
  await migrate(db, before);
  await db.prepare("INSERT INTO people (name, color, family_id) VALUES ('Old', '#000', 1)").run();
  await migrate(db);
  expect(await db.prepare("SELECT created_at FROM people").first()).toEqual({ created_at: "2026-10-13 00:00:00" });
});
