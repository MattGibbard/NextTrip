import type { Env } from "./env";

/**
 * Google search numbers for the stats page, from the Search Console API. It needs two secrets:
 * GSC_SERVICE_ACCOUNT, a Google Cloud service account's JSON key (that account added as a user on the
 * Search Console property), and GSC_SITE, the property, like "sc-domain:somewhere.party".
 * Google's numbers run two or three days behind.
 */
export interface Search {
  clicks: number;
  impressions: number;
  /** Average position in results, 1 is top. */
  position: number;
  prevClicks: number;
  prevImpressions: number;
  queries: { query: string; clicks: number; impressions: number }[];
  pages: { path: string; clicks: number; impressions: number }[];
}

type Row = { keys?: string[]; clicks: number; impressions: number; position: number };

let cachedToken: { token: string; until: number; email: string } | null = null;

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Swaps a signed request for a short-lived Google access token, kept until just before it runs out. */
async function accessToken(account: { client_email: string; private_key: string }): Promise<string> {
  if (cachedToken && cachedToken.email === account.client_email && cachedToken.until > Date.now()) return cachedToken.token;
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claims}`)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new Error(`Google sign-in failed (${res.status})`);
  cachedToken = { token: json.access_token, until: Date.now() + ((json.expires_in ?? 3600) - 120) * 1000, email: account.client_email };
  return json.access_token;
}

/** Null when the secrets aren't set or Google doesn't answer. */
export async function searchNumbers(env: Env, since: string, prevSince: string, today: string): Promise<Search | null> {
  if (!env.GSC_SERVICE_ACCOUNT || !env.GSC_SITE) return null;
  try {
    const token = await accessToken(JSON.parse(env.GSC_SERVICE_ACCOUNT));
    const ask = async (startDate: string, endDate: string, dimensions: string[] = [], rowLimit = 10): Promise<Row[]> => {
      const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env.GSC_SITE!)}/searchAnalytics/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
      });
      if (!res.ok) throw new Error(`Search Console answered ${res.status}`);
      return ((await res.json()) as { rows?: Row[] }).rows ?? [];
    };
    const dayBefore = new Date(Date.parse(since) - 86_400_000).toISOString().slice(0, 10);
    const [[now], [before], queries, pages] = await Promise.all([
      ask(since, today),
      ask(prevSince, dayBefore),
      ask(since, today, ["query"]),
      ask(since, today, ["page"]),
    ]);
    return {
      clicks: now?.clicks ?? 0,
      impressions: now?.impressions ?? 0,
      position: now?.position ?? 0,
      prevClicks: before?.clicks ?? 0,
      prevImpressions: before?.impressions ?? 0,
      queries: queries.map((r) => ({ query: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions })),
      pages: pages.map((r) => ({ path: (r.keys?.[0] ?? "").replace(/^https?:\/\/[^/]+/, "") || "/", clicks: r.clicks, impressions: r.impressions })),
    };
  } catch (err) {
    console.warn("Search Console failed", err);
    return null;
  }
}
