// The owner's stats page: only the addresses in STATS_EMAILS can sign in, and counts leave out family 1.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { migrate } from "../worker/migrate";
import { sqliteD1 } from "./sqliteD1";

const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1", STATS_EMAILS: "owner@example.com, Partner@Example.com" } as Env;
const ctx = {} as ExecutionContext;
const ORIGIN = "https://somewhere.party";

const googleCalls: { dimensions: string[]; startDate: string }[] = [];

function stubCloudflare() {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "https://api.cloudflare.com/client/v4/graphql") {
      const today = new Date().toISOString().slice(0, 10);
      if (String(init?.body).includes("workersInvocationsAdaptive")) {
        return Response.json({ data: { viewer: { accounts: [{ worker: [{ sum: { requests: 1234, errors: 2 } }] }] } }, errors: null });
      }
      return Response.json({
        data: {
          viewer: {
            accounts: [
              {
                daily: [
                  { count: 9, sum: { visits: 7 }, dimensions: { date: today } },
                  { count: 4, sum: { visits: 4 }, dimensions: { date: "2000-01-01" } },
                ],
                pages: [
                  { count: 9, dimensions: { requestPath: "/destinations/<lapland>" } },
                  { count: 5, dimensions: { requestPath: "/blog/new-post" } },
                ],
                referrers: [
                  { sum: { visits: 3 }, dimensions: { refererHost: "www.facebook.com" } },
                  { sum: { visits: 0 }, dimensions: { refererHost: "somewhere.party" } },
                ],
                countries: [{ sum: { visits: 7 }, dimensions: { countryName: "GB" } }],
                devices: [{ sum: { visits: 5 }, dimensions: { deviceType: "mobile" } }],
                vitals: [
                  {
                    count: 5,
                    dimensions: { deviceType: "mobile" },
                    quantiles: { largestContentfulPaintP75: 3100000, interactionToNextPaintP75: 80000, cumulativeLayoutShiftP75: 0.02 },
                  },
                ],
              },
            ],
          },
        },
        errors: null,
      });
    }
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(String(init?.body)).get("assertion")!;
      const claims = JSON.parse(Buffer.from(assertion.split(".")[1], "base64url").toString());
      expect(claims.iss).toBe("stats@example.iam.gserviceaccount.com");
      return Response.json({ access_token: "google-token", expires_in: 3600 });
    }
    if (url.startsWith("https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Asomewhere.party/")) {
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer google-token");
      const ask = JSON.parse(String(init?.body)) as { dimensions: string[]; startDate: string };
      googleCalls.push(ask);
      const rows = !ask.dimensions.length
        ? [{ clicks: googleCalls.length === 1 ? 12 : 6, impressions: 340, position: 8.4 }]
        : ask.dimensions[0] === "query"
          ? [{ keys: ["decide where to go on holiday"], clicks: 5, impressions: 90, position: 6 }]
          : [{ keys: ["https://somewhere.party/destinations/levi"], clicks: 4, impressions: 50, position: 3 }];
      return Response.json({ rows });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
}

function stats(cookie: string | null = null, e: Env = env, path = "/stats") {
  return worker.fetch(new Request(`${ORIGIN}${path}`, { headers: cookie ? { Cookie: cookie } : {} }), e, ctx);
}

function post(fields: Record<string, string>, cookie: string | null = null, origin = ORIGIN) {
  return worker.fetch(
    new Request(`${ORIGIN}/stats`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: cookie } : {}) },
      body: new URLSearchParams(fields).toString(),
    }),
    env,
    ctx,
  );
}

/** Signs in through the form, reading the test code off the page as previews do. */
async function signIn(email: string): Promise<string> {
  const page = await (await post({ action: "send", email })).text();
  const code = page.match(/Test code: <b>(\d{6})<\/b>/)![1];
  const res = await post({ action: "code", email, code });
  expect(res.status).toBe(303);
  return res.headers.get("Set-Cookie")!.split(";")[0];
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
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, string>, setCookie: res.headers.get("Set-Cookie") };
}

beforeAll(async () => {
  // One family signs up and adds an idea; family 1 (the owner's own) has an idea too, which mustn't count.
  const { body } = await api(null, "POST", "/auth/email", { email: "family@example.com" });
  const token = new URL(body.dev_link).searchParams.get("token");
  const cookie = (await api(null, "POST", "/auth/verify", { token })).setCookie!.split(";")[0];
  await api(cookie, "POST", "/people", { name: "Sam" });
  await api(cookie, "POST", "/ideas", { title: "Lapland", places: [{ name: "Rovaniemi", country: "Finland", country_code: "FI", lat: 66.5, lon: 25.7 }] });
  // Opening the app marks the family as active.
  await api(cookie, "GET", "/bootstrap");
  // A tap on a Book it button, and two that aren't real buttons.
  // And taps on a blog post's other ways on: two to the picker, and one that isn't a real box.
  for (const tap of [{ kind: "hotels", place: "idea_page" }, { kind: "cars", place: "idea_page" }, { kind: "hotels", place: "nowhere" }, { blog: "picker" }, { blog: "picker" }, { blog: "popup" }]) {
    expect((await api(null, "POST", "/clicks", tap)).status).toBe(204);
  }
  await env.DB.prepare("INSERT INTO ideas (title, family_id) VALUES ('Owner idea', 1)").run();
});

afterEach(() => vi.unstubAllGlobals());

it("asks for an email when not signed in", async () => {
  const html = await (await stats()).text();
  expect(html).toContain("Email me a code");
  expect(html).not.toContain("Families</span>");
});

it("only sends codes to the listed addresses, without saying who's listed", async () => {
  const other = await (await post({ action: "send", email: "someone@example.com" })).text();
  expect(other).toContain("If someone@example.com can see the stats");
  expect(other).not.toContain("Test code");
  // Even a code someone guesses doesn't let an unlisted address in.
  expect((await post({ action: "code", email: "someone@example.com", code: "123456" })).status).toBe(400);
});

it("signs in the listed addresses with the emailed code, in any case", async () => {
  const cookie = await signIn("partner@example.com");
  expect(await (await stats(cookie)).text()).toContain("Families</span>");
});

it("turns away wrong codes and stops after a few tries", async () => {
  const page = await (await post({ action: "send", email: "owner@example.com" })).text();
  const code = page.match(/Test code: <b>(\d{6})<\/b>/)![1];
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) expect((await post({ action: "code", email: "owner@example.com", code: wrong })).status).toBe(400);
  expect((await post({ action: "code", email: "owner@example.com", code })).status).toBe(400);
});

it("needs the bot check to send a code once it's switched on", async () => {
  const bot = { ...env, TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret" } as Env;
  const send = (extra: Record<string, string>) =>
    worker.fetch(
      new Request(`${ORIGIN}/stats`, {
        method: "POST",
        headers: { Origin: ORIGIN, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "send", email: "owner@example.com", ...extra }).toString(),
      }),
      bot,
      ctx,
    );
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    return Response.json({ success: (init.body as FormData).get("response") === "good" });
  });
  expect(await (await stats(null, bot)).text()).toContain('data-sitekey="site-key"');
  expect((await send({})).status).toBe(403);
  expect((await send({ "cf-turnstile-response": "bad" })).status).toBe(403);
  const ok = await send({ "cf-turnstile-response": "good" });
  expect(ok.status).toBe(200);
  expect(await ok.text()).toContain("Test code");
});

it("ignores forms posted from another site", async () => {
  expect((await post({ action: "send", email: "owner@example.com" }, null, "https://evil.example")).status).toBe(403);
});

it("signs out, and signs out anyone taken off the list", async () => {
  const cookie = await signIn("owner@example.com");
  const removed = { ...env, STATS_EMAILS: "partner@example.com" } as Env;
  expect(await (await stats(cookie, removed)).text()).toContain("Email me a code");
  expect((await post({ action: "signout" }, cookie)).headers.get("Set-Cookie")).toContain("Max-Age=0");
  expect(await (await stats(cookie)).text()).toContain("Email me a code");
});

it("shows the numbers, leaving out family 1", async () => {
  stubCloudflare();
  const cookie = await signIn("owner@example.com");
  const res = await stats(cookie, { ...env, CF_ANALYTICS_TOKEN: "t", CF_ACCOUNT_ID: "a" }, "/stats?days=7");
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
  // Visits against the period before, and which part of the site they looked at.
  expect(html).toMatch(/Visits<\/span><b>7<\/b><span class="chg up">▲ 75%/);
  expect(html).toContain("Destination guides");
  expect(html).toContain("Phones");
  expect(html).toMatch(/Main content shows<\/dt><dd>3.1s/);
  expect(html).toMatch(/Crashes<\/dt><dd>2/);
  // The family that joined: welcome not finished, one idea, opened the app.
  expect(html).toMatch(/Added an idea<\/span>.*?<span class="num">1/);
  expect(html).toMatch(/Active families<\/span><b>1<\/b>/);
  expect(html).toMatch(/Sign-in emails sent<\/dt><dd>1/);
  expect(html).toMatch(/Signed in<\/dt><dd>1/);
  expect(html).toMatch(/Book it taps<\/span><b>1<\/b>/);
  expect(html).toMatch(/From the blog<\/h2>.*?Taps<\/dt><dd>2/s);
  expect(html).toContain("Rovaniemi");
  expect(html).toContain("Finland");
  expect(html).toContain("Google search");
  expect(html).toContain("Not connected");
});

it("shows Google search numbers once Search Console is connected", async () => {
  stubCloudflare();
  const keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const account = { client_email: "stats@example.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n` };
  const e = { ...env, GSC_SERVICE_ACCOUNT: JSON.stringify(account), GSC_SITE: "sc-domain:somewhere.party" } as Env;
  const html = await (await stats(await signIn("owner@example.com"), e)).text();
  expect(html).toMatch(/Clicks<\/dt><dd>12<span class="chg up">▲ 100%/);
  expect(html).toContain("decide where to go on holiday");
  expect(html).toContain("/destinations/levi");
  expect(html).toMatch(/Click rate<\/dt><dd>4%/);
});

it("still shows the site's numbers when page visits aren't connected", async () => {
  stubCloudflare();
  const html = await (await stats(await signIn("owner@example.com"))).text();
  expect(html).toContain("Page visits aren't connected yet");
  expect(html).toContain("New families");
});

it("sorts pages into parts of the site", async () => {
  const { section } = await import("../worker/stats");
  expect(section("/")).toBe("Home");
  expect(section("/destinations")).toBe("Destinations");
  expect(section("/destinations/levi")).toBe("Destination guides");
  expect(section("/destinations/beach-holidays")).toBe("Holiday ideas pages");
  expect(section("/blog/tag/europe")).toBe("Blog");
  expect(section("/f/abc")).toBe("Sign-in and family links");
});

it("dates people who were already there to the day before join dates began", async () => {
  const db = sqliteD1();
  const before = (await import("../worker/migrate")).MIGRATIONS.filter((m) => m.name < "0019");
  await migrate(db, before);
  await db.prepare("INSERT INTO people (name, color, family_id) VALUES ('Old', '#000', 1)").run();
  await migrate(db);
  expect(await db.prepare("SELECT created_at FROM people").first()).toEqual({ created_at: "2026-10-13 00:00:00" });
});
