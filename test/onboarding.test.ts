// The welcome steps show once per person: new people start not onboarded, and finishing is remembered.
import { expect, it } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/env";
import { sqliteD1 } from "./sqliteD1";

const env = { DB: sqliteD1(), DEV_LOGIN_LINKS: "1" } as Env;

async function call(cookie: string | null, method: string, path: string, json?: unknown) {
  const res = await worker.fetch(
    new Request(`https://somewhere.party/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: json === undefined ? undefined : JSON.stringify(json),
    }),
    env,
    {} as ExecutionContext,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get("Set-Cookie") };
}

const cookieFrom = (setCookie: string | null) => setCookie!.split(";")[0];

it("remembers each person finishing the welcome steps on their own", async () => {
  const { body } = await call(null, "POST", "/auth/email", { email: "welcome@example.com" });
  const token = new URL(body.dev_link).searchParams.get("token");
  const owner = cookieFrom((await call(null, "POST", "/auth/verify", { token })).setCookie);

  // Before giving a name there's nobody to remember it for.
  expect((await call(owner, "POST", "/me/onboarded")).status).toBe(409);

  const ownerId = (await call(owner, "POST", "/people", { name: "Organiser" })).body.id;
  const share = (await call(owner, "GET", "/auth/me")).body.share_token;
  const member = cookieFrom((await call(null, "POST", "/auth/join", { token: share })).setCookie);
  const memberId = (await call(member, "POST", "/people", { name: "Member" })).body.id;

  const onboarded = async () => Object.fromEntries((await call(owner, "GET", "/people")).body.map((p: { id: number; onboarded: boolean }) => [p.id, p.onboarded]));
  expect(await onboarded()).toEqual({ [ownerId]: false, [memberId]: false });

  expect((await call(member, "POST", "/me/onboarded")).status).toBe(200);
  expect(await onboarded()).toEqual({ [ownerId]: false, [memberId]: true });
});
