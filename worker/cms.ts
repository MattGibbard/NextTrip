import type { App } from "./env";
import type { Hono } from "hono";

// GitHub sign-in for the content editor at /admin (Sveltia CMS). The editor opens /api/cms/auth in a
// pop-up, GitHub sends the visitor back to /api/cms/callback, and the callback hands the token to the
// editor window. GitHub decides who can save: only people who can push to the repository.
// Needs a GitHub OAuth app whose callback is https://somewhere.party/api/cms/callback, with its ID
// and secret in the GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET secrets.

const STATE_COOKIE = "cms_state";
const SCOPES = new Set(["repo", "public_repo", "user"]);

export function cmsRoutes(app: Hono<App>) {
  app.get("/cms/auth", (c) => {
    if (c.req.query("provider") !== "github") return page("error", { message: "Only GitHub sign-in is set up" });
    if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) return page("error", { message: "GitHub sign-in isn't set up yet" });
    const asked = (c.req.query("scope") ?? "").split(/[ ,]+/).filter(Boolean);
    const scope = asked.length && asked.every((s) => SCOPES.has(s)) ? asked.join(",") : "public_repo";
    const state = crypto.randomUUID().replace(/-/g, "");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID,
      redirect_uri: new URL("/api/cms/callback", c.req.url).toString(),
      scope,
      state,
    }).toString();
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/api/cms; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      },
    });
  });

  app.get("/cms/callback", async (c) => {
    const state = c.req.header("Cookie")?.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([a-f0-9]+)`))?.[1];
    const code = c.req.query("code");
    if (!state || state !== c.req.query("state")) return page("error", { message: "That sign-in link has expired. Try again." });
    if (!code || !c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) return page("error", { message: "GitHub didn't sign you in. Try again." });
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "somewhere.party" },
      body: JSON.stringify({ client_id: c.env.GITHUB_CLIENT_ID, client_secret: c.env.GITHUB_CLIENT_SECRET, code }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { access_token?: string; error_description?: string } | null;
    if (!data?.access_token) return page("error", { message: data?.error_description ?? "GitHub didn't sign you in. Try again." });
    return page("success", { token: data.access_token }, new URL(c.req.url).origin);
  });
}

/**
 * The pop-up's last page: tells the editor window how sign-in went, in the message format Decap and
 * Sveltia CMS expect. A token only ever goes to a window on this site's own address.
 */
function page(status: "success" | "error", payload: { token?: string; message?: string }, origin?: string): Response {
  const message = `authorization:github:${status}:${JSON.stringify({ provider: "github", ...payload })}`;
  const target = status === "success" ? origin : "*";
  const script = `
    (function () {
      var message = ${JSON.stringify(message).replace(/</g, "\\u003c")};
      var target = ${JSON.stringify(target)};
      window.addEventListener("message", function (e) {
        if (e.data !== "authorizing:github" || (target !== "*" && e.origin !== target)) return;
        window.opener && window.opener.postMessage(message, target);
      });
      window.opener && window.opener.postMessage("authorizing:github", target);
    })();`;
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head><body><p>${
    status === "success" ? "Signed in. You can close this window." : escapeHtml(payload.message ?? "Sign-in failed.")
  }</p><script>${script}</script></body></html>`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Set-Cookie": `${STATE_COOKIE}=; Path=/api/cms; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
