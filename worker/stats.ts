import type { Env } from "./env";
import { ensureSchema } from "./migrate";

/**
 * The owner's stats page at /stats: page visits from Cloudflare Web Analytics, and how many families,
 * people, trips, ideas, draws and plans there are. Cloudflare Access stands in front of the path and asks
 * for an emailed code; the Worker checks Access's signed token as well, so the page never shows without it.
 * Family 1 is the owner's own and is left out of every number.
 */
export const STATS_PATH = "/stats";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
const HOST = "somewhere.party";

export async function serveStats(req: Request, env: Env): Promise<Response> {
  if (!(await accessAllowed(req, env))) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const url = new URL(req.url);
  const asked = Number(url.searchParams.get("days"));
  const days: Range = (RANGES as readonly number[]).includes(asked) ? (asked as Range) : 30;
  const since = isoDay(Date.now() - (days - 1) * DAY);
  await ensureSchema(env.DB);
  const [site, visits] = await Promise.all([siteNumbers(env.DB, since), pageVisits(env, since)]);
  return new Response(renderStats({ days, since, site, visits }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

// ---------- Cloudflare Access ----------

type Jwk = JsonWebKey & { kid: string };
let certs: { domain: string; keys: Jwk[]; at: number } | null = null;

/** Access signs a token for each request it lets through. A missing or wrong token, or no Access settings, means no. */
export async function accessAllowed(req: Request, env: Env): Promise<boolean> {
  const team = env.ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!team || !env.ACCESS_AUD || !token) return false;
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return false;
  try {
    const header = JSON.parse(b64text(head)) as { kid?: string; alg?: string };
    const claims = JSON.parse(b64text(body)) as { aud?: string | string[]; exp?: number; iss?: string };
    if (header.alg !== "RS256") return false;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(env.ACCESS_AUD) || claims.iss !== `https://${team}` || !claims.exp || claims.exp * 1000 < Date.now()) return false;
    const jwk = await accessKey(team, header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64bytes(sig), new TextEncoder().encode(`${head}.${body}`));
  } catch {
    return false;
  }
}

/** Access's public keys, kept for an hour and fetched again when a token names one we haven't seen. */
async function accessKey(team: string, kid: string | undefined): Promise<Jwk | undefined> {
  const fresh = certs && certs.domain === team && Date.now() - certs.at < 3600_000;
  let key = fresh ? certs!.keys.find((k) => k.kid === kid) : undefined;
  if (key) return key;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) return undefined;
  const { keys } = (await res.json()) as { keys: Jwk[] };
  certs = { domain: team, keys, at: Date.now() };
  return keys.find((k) => k.kid === kid);
}

function b64bytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}
const b64text = (s: string) => new TextDecoder().decode(b64bytes(s));

// ---------- The site's own numbers ----------

export interface SiteNumbers {
  totals: { label: string; total: number; recent: number | null }[];
  /** New families per day, by date. */
  signups: Record<string, number>;
  /** Of the families that joined in the range: how many added an idea, and how many finished a draw. */
  funnel: { families: number; withIdea: number; withDraw: number };
}

export async function siteNumbers(db: D1Database, since: string): Promise<SiteNumbers> {
  const count = (sql: string) => db.prepare(sql).bind(since);
  const [families, people, trips, ideas, draws, plans, signups, funnel] = await db.batch<Record<string, number | string>>([
    count("SELECT COUNT(*) AS total, SUM(created_at >= ?) AS recent FROM families WHERE id != 1"),
    count("SELECT COUNT(*) AS total, SUM(created_at >= ?) AS recent FROM people WHERE family_id != 1 AND removed = 0"),
    count("SELECT COUNT(*) AS total, SUM(created_at >= ?) AS recent FROM trips WHERE family_id != 1"),
    count("SELECT COUNT(*) AS total, SUM(created_at >= ?) AS recent FROM ideas WHERE family_id != 1"),
    count("SELECT COUNT(*) AS total, SUM(drawn_at >= ?) AS recent FROM rounds WHERE family_id != 1 AND status = 'drawn'"),
    db.prepare("SELECT COUNT(*) AS total FROM plans WHERE family_id != 1"),
    count("SELECT date(created_at) AS day, COUNT(*) AS n FROM families WHERE id != 1 AND created_at >= ? GROUP BY day"),
    count(
      `SELECT COUNT(*) AS families,
        SUM(EXISTS (SELECT 1 FROM ideas i WHERE i.family_id = f.id)) AS withIdea,
        SUM(EXISTS (SELECT 1 FROM rounds r WHERE r.family_id = f.id AND r.status = 'drawn')) AS withDraw
       FROM families f WHERE f.id != 1 AND f.created_at >= ?`,
    ),
  ]);
  const row = (r: D1Result<Record<string, number | string>>) => r.results[0] ?? {};
  const num = (v: unknown) => Number(v ?? 0);
  const total = (label: string, r: D1Result<Record<string, number | string>>, recent = true) => ({
    label,
    total: num(row(r).total),
    recent: recent ? num(row(r).recent) : null,
  });
  const f = row(funnel);
  return {
    totals: [
      total("Families", families),
      total("People", people),
      total("Ideas", ideas),
      total("Trips", trips),
      total("Draws", draws),
      total("Trip plans", plans, false),
    ],
    signups: Object.fromEntries(signups.results.map((r) => [String(r.day), num(r.n)])),
    funnel: { families: num(f.families), withIdea: num(f.withIdea), withDraw: num(f.withDraw) },
  };
}

// ---------- Page visits from Cloudflare Web Analytics ----------

export interface Visits {
  /** Visits and page views per day, by date. */
  daily: Record<string, { visits: number; views: number }>;
  pages: { path: string; views: number }[];
  referrers: { host: string; visits: number }[];
  countries: { country: string; visits: number }[];
}

const VISITS_QUERY = `query($account: String!, $since: Date!, $host: String!) {
  viewer { accounts(filter: { accountTag: $account }) {
    daily: rumPageloadEventsAdaptiveGroups(limit: 100, filter: { date_geq: $since, requestHost: $host }, orderBy: [date_ASC]) {
      count sum { visits } dimensions { date } }
    pages: rumPageloadEventsAdaptiveGroups(limit: 10, filter: { date_geq: $since, requestHost: $host }, orderBy: [count_DESC]) {
      count dimensions { requestPath } }
    referrers: rumPageloadEventsAdaptiveGroups(limit: 10, filter: { date_geq: $since, requestHost: $host, refererHost_neq: "" }, orderBy: [sum_visits_DESC]) {
      sum { visits } dimensions { refererHost } }
    countries: rumPageloadEventsAdaptiveGroups(limit: 8, filter: { date_geq: $since, requestHost: $host }, orderBy: [sum_visits_DESC]) {
      sum { visits } dimensions { countryName } }
  } }
}`;

type Group = { count?: number; sum?: { visits: number }; dimensions: Record<string, string> };

/** Null when the token isn't set or Cloudflare doesn't answer; the page says so and still shows the rest. */
export async function pageVisits(env: Env, since: string): Promise<Visits | null> {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return null;
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: VISITS_QUERY, variables: { account: env.CF_ACCOUNT_ID, since, host: HOST } }),
    });
    const json = (await res.json()) as { data?: { viewer: { accounts: Record<string, Group[]>[] } }; errors?: unknown[] | null };
    const acc = json.data?.viewer.accounts[0];
    if (!res.ok || json.errors?.length || !acc) return null;
    return {
      daily: Object.fromEntries(acc.daily.map((g) => [g.dimensions.date, { visits: g.sum?.visits ?? 0, views: g.count ?? 0 }])),
      pages: acc.pages.map((g) => ({ path: g.dimensions.requestPath, views: g.count ?? 0 })),
      referrers: acc.referrers
        .filter((g) => g.dimensions.refererHost !== HOST && (g.sum?.visits ?? 0) > 0)
        .map((g) => ({ host: g.dimensions.refererHost.replace(/^www\./, ""), visits: g.sum?.visits ?? 0 })),
      countries: acc.countries.map((g) => ({ country: g.dimensions.countryName, visits: g.sum?.visits ?? 0 })),
    };
  } catch {
    return null;
  }
}

// ---------- The page ----------

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString("en-GB");

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });
function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** One bar per day. The tallest bar fills the chart; days with nothing still get a hairline so gaps read as zero. */
function barChart(values: number[], dates: string[], label: string, tone: "accent" | "gold"): string {
  const w = 320;
  const h = 96;
  const max = Math.max(1, ...values);
  const gap = values.length > 40 ? 1 : 2;
  const bw = (w - gap * (values.length - 1)) / values.length;
  const bars = values
    .map((v, i) => {
      const bh = Math.max(1, (v / max) * (h - 4));
      return `<rect x="${(i * (bw + gap)).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1.5"><title>${dates[i]}: ${fmt(v)}</title></rect>`;
    })
    .join("");
  const first = dates[0].slice(5).split("-").reverse().join("/");
  const last = dates[dates.length - 1].slice(5).split("-").reverse().join("/");
  return `<figure class="chart">
  <figcaption><span>${label}</span><b>${fmt(values.reduce((a, b) => a + b, 0))}</b></figcaption>
  <svg class="bars ${tone}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${label} per day, highest ${fmt(max)}">${bars}</svg>
  <div class="axis"><span>${first}</span><span>peak ${fmt(max)}</span><span>${last}</span></div>
</figure>`;
}

function list(title: string, rows: { name: string; value: number }[], empty: string): string {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `<li><span class="fill" style="width:${((r.value / max) * 100).toFixed(1)}%"></span><span class="name">${esc(r.name)}</span><span class="num">${fmt(r.value)}</span></li>`,
        )
        .join("")
    : `<li class="empty">${empty}</li>`;
  return `<section class="panel"><h2>${title}</h2><ol class="rows">${body}</ol></section>`;
}

export function renderStats({ days, since, site, visits }: { days: Range; since: string; site: SiteNumbers; visits: Visits | null }): string {
  const dates = Array.from({ length: days }, (_, i) => isoDay(Date.parse(since) + i * DAY));
  const visitorTotal = visits ? dates.reduce((n, d) => n + (visits.daily[d]?.visits ?? 0), 0) : null;
  const tabs = RANGES.map(
    (r) => `<a href="${STATS_PATH}?days=${r}"${r === days ? ' aria-current="page"' : ""}>${r} days</a>`,
  ).join("");
  const tiles = site.totals
    .map(
      (t) => `<div class="tile"><span class="label">${t.label}</span><b>${fmt(t.total)}</b>${
        t.recent === null ? "" : `<span class="recent${t.recent ? " up" : ""}">+${fmt(t.recent)}</span>`
      }</div>`,
    )
    .join("");
  const steps = [
    { label: "Visits", value: visitorTotal },
    { label: "New families", value: site.funnel.families },
    { label: "Added an idea", value: site.funnel.withIdea },
    { label: "Did a draw", value: site.funnel.withDraw },
  ];
  const top = Math.max(1, ...steps.map((s) => s.value ?? 0));
  const funnel = steps
    .map((s, i) => {
      const prev = i > 0 ? steps[i - 1].value : null;
      const pct = s.value !== null && prev ? ` <small>${Math.round((s.value / prev) * 100)}%</small>` : "";
      return `<li><span class="name">${s.label}</span><span class="track"><span class="fill" style="width:${(((s.value ?? 0) / top) * 100).toFixed(1)}%"></span></span><span class="num">${s.value === null ? "–" : fmt(s.value)}${pct}</span></li>`;
    })
    .join("");
  const noVisits = `<p class="note">Page visits aren't connected yet. Set the CF_ANALYTICS_TOKEN and CF_ACCOUNT_ID secrets on the Worker.</p>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Stats">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1c2421">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/inter-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<title>Stats · somewhere🎉</title>
<style>${STYLES}</style>
</head>
<body>
<header class="board">
  <div class="top"><span class="eyebrow">somewhere🎉 · OWNER</span><span class="eyebrow">${esc(new Date().toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></div>
  <h1>Stats</h1>
  <nav class="seg" aria-label="Range">${tabs}</nav>
</header>
<main>
  <section class="tiles" aria-label="Totals">${tiles}</section>
  <p class="hint">Totals leave out your own family. Green numbers are new in the last ${days} days.</p>

  <section class="panel">
    <h2>Every day</h2>
    ${visits ? barChart(dates.map((d) => visits.daily[d]?.visits ?? 0), dates, "Visits", "accent") : noVisits}
    ${barChart(dates.map((d) => site.signups[d] ?? 0), dates, "New families", "gold")}
  </section>

  <section class="panel">
    <h2>From visit to draw</h2>
    <ol class="funnel">${funnel}</ol>
    <p class="note">Families that joined in the last ${days} days, and how far they've got.</p>
  </section>

  ${visits ? list("Top pages", visits.pages.map((p) => ({ name: p.path, value: p.views })), "No page views yet") : ""}
  ${visits ? list("Came from", visits.referrers.map((r) => ({ name: r.host, value: r.visits })), "Nobody has followed a link here yet") : ""}
  ${visits ? list("Countries", visits.countries.map((c) => ({ name: countryName(c.country), value: c.visits })), "No visits yet") : ""}
  ${visits ? `<p class="hint">Visits come from Cloudflare Web Analytics, which samples busier ranges, so they're close estimates. In the signed-in app only the first page someone opens counts.</p>` : ""}
</main>
</body>
</html>`;
}

const STYLES = `
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("/fonts/inter-var-latin.woff2") format("woff2"); }
@font-face { font-family: "DM Mono"; font-style: normal; font-weight: 500; font-display: swap; src: url("/fonts/dm-mono-500-latin.woff2") format("woff2"); }
:root {
  --bg: #f6f7f5; --surface: #ffffff; --surface-2: #eef2ef; --text: #1c2421; --muted: #66716c; --border: #dde3df;
  --accent: #0f766e; --accent-soft: #d5efeb; --gold: #d97706; --gold-soft: #fdf0dc;
  --board: #1c2421; --board-line: #2c3833; --board-muted: #96a29c; --board-lit: #2dd4bf; --on-bright: #052e2a;
  --shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 16px rgb(0 0 0 / 0.05);
  --mono: "DM Mono", ui-monospace, Menlo, monospace;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1412; --surface: #18201d; --surface-2: #212b27; --text: #e7ece9; --muted: #96a29c; --border: #2c3833;
    --accent: #2dd4bf; --accent-soft: #123b36; --gold: #fbbf24; --gold-soft: #3a2a0c; --board: #0a0e0c; --board-line: #26302c;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4);
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 400 1rem/1.45 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.board { background: var(--board); color: #fff; padding: calc(env(safe-area-inset-top) + 14px) 16px 16px; }
.board .top { display: flex; justify-content: space-between; gap: 12px; }
.eyebrow { font: 500 0.7rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--board-muted); }
h1 { font-size: 2rem; letter-spacing: -0.02em; margin: 10px 0 14px; }
.seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--board-line); padding: 4px; border-radius: 10px; }
.seg a { text-align: center; padding: 8px 0; border-radius: 7px; color: var(--board-muted); text-decoration: none; font: 500 0.8rem/1 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; }
.seg a[aria-current] { background: var(--board-lit); color: var(--on-bright); }
main { max-width: 640px; margin: 0 auto; padding: 16px 16px calc(env(safe-area-inset-bottom) + 32px); display: grid; gap: 14px; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); padding: 12px; display: grid; gap: 2px; min-width: 0; }
.tile .label { font: 500 0.7rem/1.2 var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.tile b { font-size: 1.75rem; line-height: 1.1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.recent { justify-self: start; font: 500 0.75rem/1 var(--mono); padding: 3px 6px; border-radius: 6px; background: var(--surface-2); color: var(--muted); }
.recent.up { background: var(--accent-soft); color: var(--accent); }
.hint { margin: -4px 2px 0; font-size: 0.8rem; color: var(--muted); }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); padding: 14px; display: grid; gap: 14px; }
h2 { margin: 0; font: 500 0.75rem/1 var(--mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
.chart { margin: 0; display: grid; gap: 6px; }
.chart figcaption { display: flex; justify-content: space-between; align-items: baseline; font-weight: 600; }
.chart figcaption b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.bars { width: 100%; height: 96px; display: block; }
.bars.accent rect { fill: var(--accent); }
.bars.gold rect { fill: var(--gold); }
.axis { display: flex; justify-content: space-between; font: 500 0.7rem/1 var(--mono); color: var(--muted); }
.funnel, .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.funnel li { display: grid; grid-template-columns: 7.5rem 1fr auto; align-items: center; gap: 10px; font-size: 0.9rem; }
.funnel .track { height: 10px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
.funnel .fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.num { font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; }
.num small { font: 500 0.7rem/1 var(--mono); color: var(--muted); margin-left: 4px; }
.rows li { position: relative; display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 8px; font-size: 0.9rem; overflow: hidden; }
.rows .fill { position: absolute; inset: 0 auto 0 0; background: var(--accent-soft); z-index: 0; }
.rows .name, .rows .num { position: relative; }
.rows .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.rows .empty { color: var(--muted); }
.note { margin: 0; font-size: 0.85rem; color: var(--muted); }
@media (min-width: 560px) { .tiles { grid-template-columns: repeat(6, 1fr); } .tile b { font-size: 1.5rem; } }
`;
