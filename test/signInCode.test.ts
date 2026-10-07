// The 6-digit code from the sign-in email, for when the link opens in an email app's own browser.
import { expect, it } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { sqliteD1 } from "./sqliteD1";

const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1" } as Env;

async function call(path: string, json: unknown) {
  const res = await worker.fetch(
    new Request(`https://somewhere.party/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) }),
    env,
    {} as ExecutionContext,
  );
  return { status: res.status, body: await res.json(), setCookie: res.headers.get("Set-Cookie") };
}

const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

it("signs in with the code, typed with a space, and only once", async () => {
  const { dev_code: code, dev_link: link } = (await call("/auth/email", { email: "Code@Example.com" })).body;
  expect(code).toMatch(/^\d{6}$/);
  const ok = await call("/auth/code", { email: "code@example.com", code: `${code.slice(0, 3)} ${code.slice(3)}` });
  expect(ok.status).toBe(200);
  expect(ok.setCookie).toContain("nexttrip_session=");
  expect((await call("/auth/code", { email: "code@example.com", code })).status).toBe(400);
  // The link and code are one sign-in: using the code uses up the link too.
  expect((await call("/auth/verify", { token: new URL(link).searchParams.get("token") })).status).toBe(400);
});

it("doesn't take another address's code", async () => {
  const { dev_code: code } = (await call("/auth/email", { email: "first@example.com" })).body;
  expect((await call("/auth/code", { email: "second@example.com", code })).status).toBe(400);
  expect((await call("/auth/code", { email: "first@example.com", code })).status).toBe(200);
});

it("stops working after five wrong tries, even with the right code", async () => {
  const { dev_code: code } = (await call("/auth/email", { email: "guess@example.com" })).body;
  for (let i = 0; i < 4; i++) expect((await call("/auth/code", { email: "guess@example.com", code: wrong(code) })).body.error).toMatch(/isn't right/);
  expect((await call("/auth/code", { email: "guess@example.com", code: wrong(code) })).body.error).toMatch(/too many tries/);
  expect((await call("/auth/code", { email: "guess@example.com", code })).status).toBe(400);
});
