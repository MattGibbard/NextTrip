// The site-wide protections: security headers, the cross-site form check and the sign-in bot check.
import { afterEach, expect, it, vi } from "vitest";
import worker, { SECURITY_HEADERS } from "../worker/index";
import type { Env } from "../worker/env";
import { sqliteD1 } from "./sqliteD1";

const base = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1" } as Env;
const ctx = {} as ExecutionContext;

function post(path: string, body: string, headers: Record<string, string>, env: Env = base) {
  return worker.fetch(new Request(`https://somewhere.party/api${path}`, { method: "POST", headers, body }), env, ctx);
}

afterEach(() => vi.unstubAllGlobals());

it("sends the security headers with API answers and pages", async () => {
  const api = await worker.fetch(new Request("https://somewhere.party/api/auth/me"), base, ctx);
  const assets = { fetch: async () => new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } }) } as unknown as Fetcher;
  const page = await worker.fetch(new Request("https://somewhere.party/about"), { ...base, ASSETS: assets }, ctx);
  for (const res of [api, page]) {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(name)).toBe(value);
  }
});

it("adds the headers to redirects too", async () => {
  const res = await worker.fetch(new Request("https://nexttrip.matt-gibbard.workers.dev/about"), base, ctx);
  expect(res.status).toBe(301);
  expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
});

it("turns away forms posted from another site", async () => {
  const res = await post("/auth/logout", "{}", { "Content-Type": "text/plain", Origin: "https://evil.example" });
  expect(res.status).toBe(403);
  // The app's own JSON requests still work.
  expect((await post("/auth/logout", "{}", { "Content-Type": "application/json", Origin: "https://somewhere.party" })).status).toBe(200);
});

it("needs the bot check to send a sign-in email once it's switched on", async () => {
  const env = { ...base, TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret" } as Env;
  const key = await worker.fetch(new Request("https://somewhere.party/api/auth/turnstile"), env, ctx);
  expect(await key.json()).toEqual({ site_key: "site-key" });

  const seen: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const form = init.body as FormData;
    seen.push(`${form.get("secret")}:${form.get("response")}:${form.get("remoteip")}`);
    return Response.json({ success: form.get("response") === "good" });
  });
  const json = { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" };
  expect((await post("/auth/email", JSON.stringify({ email: "bot@example.com" }), json, env)).status).toBe(403);
  expect((await post("/auth/email", JSON.stringify({ email: "bot@example.com", turnstile: "bad" }), json, env)).status).toBe(403);
  const ok = await post("/auth/email", JSON.stringify({ email: "person@example.com", turnstile: "good" }), json, env);
  expect(ok.status).toBe(200);
  expect(seen).toEqual(["secret:bad:203.0.113.9", "secret:good:203.0.113.9"]);
});

it("leaves the bot check off until both keys are set", async () => {
  const env = { ...base, TURNSTILE_SITE_KEY: "site-key" } as Env;
  const key = await worker.fetch(new Request("https://somewhere.party/api/auth/turnstile"), env, ctx);
  expect(await key.json()).toEqual({ site_key: null });
  expect((await post("/auth/email", JSON.stringify({ email: "nocheck@example.com" }), { "Content-Type": "application/json" }, env)).status).toBe(200);
});
