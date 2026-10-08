import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { cmsRoutes } from "../worker/cms";
import type { App, Env } from "../worker/env";

const app = new Hono<App>().basePath("/api");
cmsRoutes(app);
const env = { GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret" } as Env;

describe("content editor sign-in", () => {
  it("sends the editor to GitHub with a state it remembers", async () => {
    const res = await app.request("https://somewhere.party/api/cms/auth?provider=github&scope=repo", {}, env);
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get("Location")!);
    expect(to.origin + to.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(to.searchParams.get("redirect_uri")).toBe("https://somewhere.party/api/cms/callback");
    expect(to.searchParams.get("scope")).toBe("repo");
    expect(res.headers.get("Set-Cookie")).toContain(`cms_state=${to.searchParams.get("state")}`);
  });

  it("won't ask GitHub for scopes it doesn't need", async () => {
    const res = await app.request("https://somewhere.party/api/cms/auth?provider=github&scope=admin:org", {}, env);
    expect(new URL(res.headers.get("Location")!).searchParams.get("scope")).toBe("public_repo");
  });

  it("refuses a callback whose state doesn't match", async () => {
    const res = await app.request("https://somewhere.party/api/cms/callback?code=abc&state=bad", { headers: { Cookie: "cms_state=good" } }, env);
    const html = await res.text();
    expect(html).toContain("authorization:github:error:");
    expect(html).not.toContain("authorization:github:success:");
  });

  it("says so when sign-in isn't set up", async () => {
    const res = await app.request("https://somewhere.party/api/cms/auth?provider=github", {}, {} as Env);
    expect(await res.text()).toContain("isn't set up yet");
  });
});
