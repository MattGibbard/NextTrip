// The owner's stats page: only the addresses in STATS_EMAILS can sign in, and counts leave out family 1.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { migrate } from "../worker/migrate";
import { sqliteD1 } from "./sqliteD1";

const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1", STATS_EMAILS: "owner@example.com, Partner@Example.com" } as Env;
const ctx = {} as ExecutionContext;
const ORIGIN = "https://somewhere.party";

function stubCloudflare() {
  vi.stubGlobal("fetch", async (url: string) => {
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
  return { body: (await res.json()) as Record<string, string>, setCookie: res.headers.get("Set-Cookie") };
}

beforeAll(async () => {
  // One family signs up and adds an idea; family 1 (the owner's own) has an idea too, which mustn't count.
  const { body } = await api(null, "POST", "/auth/email", { email: "family@example.com" });
  const token = new URL(body.dev_link).searchParams.get("token");
  const cookie = (await api(null, "POST", "/auth/verify", { token })).setCookie!.split(";")[0];
  await api(cookie, "POST", "/people", { name: "Sam" });
  await api(cookie, "POST", "/ideas", { title: "Lapland", places: [] });
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
});

it("still shows the site's numbers when page visits aren't connected", async () => {
  stubCloudflare();
  const html = await (await stats(await signIn("owner@example.com"))).text();
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
