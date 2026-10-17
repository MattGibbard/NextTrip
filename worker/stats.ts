import type { Env } from "./env";
import { ensureSchema } from "./migrate";
import { statsSignIn } from "./statsSignIn";
import { siteNumbers } from "./statsSite";
import type { Period, SiteNumbers } from "./statsSite";
import { pageVisits, workerHealth } from "./statsCloudflare";
import type { Visits, WorkerHealth } from "./statsCloudflare";
import { searchNumbers } from "./statsSearch";
import type { Search } from "./statsSearch";

/**
 * The owner's stats page at /stats. Numbers come from the site's database (worker/statsSite.ts), Cloudflare
 * (worker/statsCloudflare.ts) and Google Search Console (worker/statsSearch.ts). Only the addresses in the
 * STATS_EMAILS secret can sign in (worker/statsSignIn.ts). Family 1 is the owner's own and is left out.
 */
export const STATS_PATH = "/stats";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];
/** Cloudflare looks back at most 13 weeks, so longer periods have nothing to compare with. */
const CLOUDFLARE_DAYS = 91;

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Hub pages share /destinations/ with the guides; their slugs come from the content folder. */
const HUBS = new Set(Object.keys(import.meta.glob("../content/hubs/*.json")).map((p) => p.split("/").pop()!.replace(/\.json$/, "")));

export async function serveStats(req: Request, env: Env): Promise<Response> {
  await ensureSchema(env.DB);
  const signedIn = await statsSignIn(req, env);
  if (signedIn instanceof Response) return signedIn;
  const url = new URL(req.url);
  const asked = Number(url.searchParams.get("days"));
  const days: Range = (RANGES as readonly number[]).includes(asked) ? (asked as Range) : 30;
  const today = isoDay(Date.now());
  const since = isoDay(Date.now() - (days - 1) * DAY);
  const prevSince = isoDay(Date.now() - (2 * days - 1) * DAY);
  const [site, visits, worker, search, pageDates] = await Promise.all([
    siteNumbers(env.DB, since, prevSince),
    pageVisits(env, since, 2 * days <= CLOUDFLARE_DAYS ? prevSince : null),
    workerHealth(env, since),
    searchNumbers(env, since, prevSince, today),
    newPages(env, today),
  ]);
  return htmlPage(renderStats({ days, since, site, visits, worker, search, pageDates }));
}

/** Every answer from /stats: never cached, never in search results. */
export function htmlPage(html: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(html, { ...init, headers });
}

/** Public pages that first went up in the last two weeks, from the list the build writes (scripts/prerender.mjs). */
async function newPages(env: Env, today: string): Promise<{ path: string; published: string }[]> {
  if (!env.ASSETS) return [];
  try {
    const res = await env.ASSETS.fetch(new Request("https://somewhere.party/page-dates.json"));
    if (!res.ok) return [];
    const cutoff = isoDay(Date.parse(today) - 13 * DAY);
    return ((await res.json()) as { path: string; published: string }[]).filter((p) => p.published >= cutoff);
  } catch {
    return [];
  }
}

// ---------- The page ----------

const fmt = (n: number) => n.toLocaleString("en-GB");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

export function esc(s: string): string {
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

/** "▲ 40%" against the period before. Nothing when there's no period before to compare with. */
function change(current: number, prev: number | null): string {
  if (prev === null) return "";
  if (prev === 0) return current ? `<span class="chg up">new</span>` : "";
  const d = Math.round(((current - prev) / prev) * 100);
  if (d === 0) return `<span class="chg">±0%</span>`;
  return `<span class="chg ${d > 0 ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d)}%</span>`;
}

/** One bar per day. The tallest bar fills the chart; days with nothing still get a hairline so gaps read as zero. */
function barChart(values: number[], dates: string[], label: string, tone: "accent" | "gold", extra = ""): string {
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
  <figcaption><span>${label}</span><span><b>${fmt(values.reduce((a, b) => a + b, 0))}</b>${extra}</span></figcaption>
  <svg class="bars ${tone}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${label} per day, highest ${fmt(max)}">${bars}</svg>
  <div class="axis"><span>${first}</span><span>peak ${fmt(max)}</span><span>${last}</span></div>
</figure>`;
}

type ListRow = { name: string; value: number; note?: string };

/** Rows with a bar behind each, as long as its share of the biggest. */
function rows(items: ListRow[], empty: string): string {
  const max = Math.max(1, ...items.map((r) => r.value));
  const body = items.length
    ? items
        .map(
          (r) =>
            `<li><span class="fill" style="width:${((r.value / max) * 100).toFixed(1)}%"></span><span class="name">${esc(r.name)}${
              r.note ? ` <small>${esc(r.note)}</small>` : ""
            }</span><span class="num">${fmt(r.value)}</span></li>`,
        )
        .join("")
    : `<li class="empty">${esc(empty)}</li>`;
  return `<ol class="rows">${body}</ol>`;
}

const panel = (title: string, body: string, note = "") =>
  `<section class="panel"><h2>${title}</h2>${body}${note ? `<p class="note">${note}</p>` : ""}</section>`;
const sub = (title: string) => `<h3>${title}</h3>`;

/** Small label and number pairs, two or three to a row. */
function facts(items: { label: string; value: string; extra?: string; tone?: "good" | "ok" | "poor" }[]): string {
  return `<dl class="facts">${items
    .map((i) => `<div${i.tone ? ` class="${i.tone}"` : ""}><dt>${i.label}</dt><dd>${i.value}${i.extra ?? ""}</dd></div>`)
    .join("")}</dl>`;
}

/** A step-by-step funnel: each bar against the first, each percentage against the step before. */
function funnel(steps: { label: string; value: number | null }[]): string {
  const top = Math.max(1, ...steps.map((s) => s.value ?? 0));
  return `<ol class="funnel">${steps
    .map((s, i) => {
      const before = i > 0 ? steps[i - 1].value : null;
      const share = s.value !== null && before ? ` <small>${pct(s.value, before)}</small>` : "";
      return `<li><span class="name">${s.label}</span><span class="track"><span class="fill" style="width:${(((s.value ?? 0) / top) * 100).toFixed(1)}%"></span></span><span class="num">${
        s.value === null ? "–" : fmt(s.value)
      }${share}</span></li>`;
    })
    .join("")}</ol>`;
}

/** Which part of the site a page belongs to. */
export function section(path: string): string {
  if (path === "/") return "Home";
  if (path === "/destinations" || path === "/destinations/") return "Destinations";
  const guide = path.match(/^\/destinations\/([^/]+)/);
  if (guide) return HUBS.has(guide[1]) ? "Holiday ideas pages" : "Destination guides";
  if (/^\/blog(\/|$)/.test(path)) return "Blog";
  if (path.startsWith("/how-it-works")) return "How it works";
  if (/^\/(signin|f\/|p\/)/.test(path)) return "Sign-in and family links";
  return "Other pages";
}

const BOOK_KIND_NAMES: Record<string, string> = { flights: "✈️ Flights", hotels: "🏨 Hotels", things: "🎟️ Things to do" };
const BOOK_PLACE_NAMES: Record<string, string> = {
  draw_result: "Draw result",
  idea_page: "Idea pages",
  been_page: "Been trip pages",
  trip_plan: "Trip plans",
};

/** Google's thresholds for a good, middling and poor page experience. */
const tone = (v: number | null, good: number, poor: number) => (v === null ? undefined : v <= good ? "good" : v <= poor ? "ok" : "poor");
const ms = (v: number | null) => (v === null ? "–" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`);

export interface StatsView {
  days: Range;
  since: string;
  site: SiteNumbers;
  visits: Visits | null;
  worker: WorkerHealth | null;
  search: Search | null;
  pageDates: { path: string; published: string }[];
}

export function renderStats({ days, since, site, visits, worker, search, pageDates }: StatsView): string {
  const dates = Array.from({ length: days }, (_, i) => isoDay(Date.parse(since) + i * DAY));
  const visitTotal = visits ? dates.reduce((n, d) => n + (visits.daily[d]?.visits ?? 0), 0) : null;
  const tabs = RANGES.map((r) => `<a href="${STATS_PATH}?days=${r}"${r === days ? ' aria-current="page"' : ""}>${r} days</a>`).join("");
  const period = (p: Period) => `${fmt(p.current)}${change(p.current, p.prev)}`;

  const tile = (label: string, value: string, extra = "") => `<div class="tile"><span class="label">${label}</span><b>${value}</b>${extra}</div>`;
  const tiles = [
    tile("Visits", visitTotal === null ? "–" : fmt(visitTotal), visits && visitTotal !== null ? change(visitTotal, visits.prevVisits) : ""),
    ...site.totals.map((t) =>
      tile(t.label, fmt(t.total), t.recent === null ? "" : `<span class="recent${t.recent ? " up" : ""}">+${fmt(t.recent)}</span>${change(t.recent, t.prev)}`),
    ),
    tile("Active families", fmt(site.active.period), `<span class="recent">${fmt(site.active.week)} in 7 days</span>`),
    tile("Book it taps", fmt(site.book.total.current), change(site.book.total.current, site.book.total.prev)),
  ].join("");

  const noVisits = `<p class="note">Page visits aren't connected yet. Set the CF_ANALYTICS_TOKEN and CF_ACCOUNT_ID secrets on the Worker.</p>`;

  // Which parts of the site get looked at, and how the newest pages are doing.
  let content = "";
  if (visits) {
    const bySection = new Map<string, number>();
    for (const p of visits.pages) bySection.set(section(p.path), (bySection.get(section(p.path)) ?? 0) + p.views);
    const views = new Map(visits.pages.map((p) => [p.path.replace(/\/$/, "") || "/", p.views]));
    const fresh = pageDates
      .map((p) => ({ name: p.path, value: views.get(p.path) ?? 0, note: `${p.published.slice(8)}/${p.published.slice(5, 7)}` }))
      .sort((a, b) => b.value - a.value || b.note.localeCompare(a.note))
      .slice(0, 12);
    content = panel(
      "What people look at",
      `${sub("By part of the site")}${rows([...bySection].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value), "No page views yet")}
       ${sub("Top pages")}${rows(visits.pages.slice(0, 10).map((p) => ({ name: p.path, value: p.views })), "No page views yet")}
       ${sub("New pages (last 2 weeks)")}${rows(fresh, "No new pages in the last two weeks")}`,
      "Page views. New pages show the day they went up and their views in this period.",
    );
  }

  const searchPanel = search
    ? panel(
        "Google search",
        `${facts([
          { label: "Clicks", value: fmt(search.clicks), extra: change(search.clicks, search.prevClicks) },
          { label: "Seen in results", value: fmt(search.impressions), extra: change(search.impressions, search.prevImpressions) },
          { label: "Click rate", value: pct(search.clicks, search.impressions) },
          { label: "Average position", value: search.position ? search.position.toFixed(1) : "–" },
        ])}
         ${sub("Searches")}${rows(search.queries.map((q) => ({ name: q.query, value: q.clicks, note: `${fmt(q.impressions)} seen` })), "No searches yet")}
         ${sub("Pages")}${rows(search.pages.map((p) => ({ name: p.path, value: p.clicks, note: `${fmt(p.impressions)} seen` })), "No pages in search yet")}`,
        "From Google Search Console, which runs two or three days behind. Numbers are clicks.",
      )
    : panel("Google search", "", "Not connected. Set the GSC_SERVICE_ACCOUNT and GSC_SITE secrets on the Worker to see Google clicks and searches here.");

  const d = site.draws;
  const vitals = visits?.vitals ?? [];
  const deviceName = (v: string) => (v === "mobile" ? "Phones" : v === "desktop" ? "Computers" : v === "tablet" ? "Tablets" : v);

  return pageShell(
    `<nav class="seg" aria-label="Period">${tabs}</nav>`,
    `
  <section class="tiles" aria-label="Totals">${tiles}</section>
  <p class="hint">Your own family is left out. Green numbers are new in the last ${days} days, and arrows compare with the ${days} days before${
    days * 2 > CLOUDFLARE_DAYS ? " (Cloudflare can't look back far enough to compare visits)" : ""
  }. Active families opened the app in this period.</p>

  ${panel(
    "Every day",
    `${visits ? barChart(dates.map((x) => visits.daily[x]?.visits ?? 0), dates, "Visits", "accent", visitTotal !== null ? change(visitTotal, visits.prevVisits) : "") : noVisits}
    ${barChart(dates.map((x) => site.signups[x] ?? 0), dates, "New families", "gold", change(site.totals[0].recent ?? 0, site.totals[0].prev))}`,
  )}

  ${panel(
    "From visit to draw",
    funnel([
      { label: "Visits", value: visitTotal },
      { label: "New families", value: site.funnel.families },
      { label: "Finished welcome", value: site.funnel.welcomed },
      { label: "Added an idea", value: site.funnel.withIdea },
      { label: "Invited family", value: site.funnel.invited },
      { label: "Did a draw", value: site.funnel.withDraw },
    ]),
    `Families that joined in the last ${days} days, and how far they've got. Percentages are against the step before.`,
  )}

  ${panel(
    "Signing in",
    facts([
      { label: "Sign-in emails sent", value: period(site.signin.emails) },
      { label: "Signed in", value: period(site.signin.done) },
      { label: "Got through", value: pct(site.signin.done.current, site.signin.emails.current) },
    ]),
    "Organisers' email sign-ins, not counting yours. If far fewer sign in than get an email, emails may be landing in spam.",
  )}

  ${panel(
    "Book it taps",
    `${facts([{ label: "Taps", value: period(site.book.total) }])}
     ${sub("What")}${rows(Object.entries(site.book.kinds).map(([k, value]) => ({ name: BOOK_KIND_NAMES[k] ?? k, value })), "")}
     ${sub("Where")}${rows(Object.entries(site.book.places).map(([k, value]) => ({ name: BOOK_PLACE_NAMES[k] ?? k, value })), "")}`,
    "Taps on the flight, hotel and things-to-do buttons. Bookings themselves show in Stay22 and Travelpayouts.",
  )}

  ${searchPanel}
  ${content}

  ${panel(
    "Families",
    `${sub("Family size")}${rows(site.familySizes.map((s) => ({ name: s.size, value: s.families })), "No families yet")}
     ${sub("Draws")}${facts([
       { label: "Draws done", value: fmt(d.total) },
       { label: "With dates", value: pct(d.dates, d.total), extra: ` <small>${fmt(d.dates)}</small>` },
       { label: "With filters", value: pct(d.filters, d.total), extra: ` <small>${fmt(d.filters)}</small>` },
       { label: "With swipes", value: pct(d.swipes, d.total), extra: ` <small>${fmt(d.swipes)}</small>` },
     ])}
     ${sub("Trip plans")}${facts([
       { label: "Winners planned", value: pct(site.plans.planned, site.plans.won), extra: ` <small>${fmt(site.plans.planned)} of ${fmt(site.plans.won)}</small>` },
       { label: "Plan items booked", value: pct(site.plans.booked, site.plans.items), extra: ` <small>${fmt(site.plans.booked)} of ${fmt(site.plans.items)}</small>` },
     ])}`,
    "All time.",
  )}

  ${panel(
    "Popular destinations",
    `${sub("Places")}${rows(site.places.map((p) => ({ name: p.name, value: p.families, note: countryName(p.country) })), "No ideas yet")}
     ${sub("Countries")}${rows(site.countries.map((c) => ({ name: countryName(c.country), value: c.families })), "No ideas yet")}`,
    "How many families have each one in their ideas, all time.",
  )}

  ${
    visits
      ? panel(
          "Visitors",
          `${sub("Came from")}${rows(visits.referrers.map((r) => ({ name: r.host, value: r.visits })), "Nobody has followed a link here yet")}
           ${sub("Countries")}${rows(visits.countries.map((c) => ({ name: countryName(c.country), value: c.visits })), "No visits yet")}
           ${sub("Devices")}${rows(visits.devices.map((x) => ({ name: deviceName(x.device), value: x.visits })), "No visits yet")}`,
          "Visits. Cloudflare samples busier periods, so these are close estimates.",
        )
      : ""
  }

  ${panel(
    "Site health",
    `${vitals
      .map(
        (v) => `${sub(`Page speed on ${deviceName(v.device).toLowerCase()}`)}${facts([
          { label: "Main content shows", value: ms(v.lcp), tone: tone(v.lcp, 2500, 4000) },
          { label: "Reacts to taps", value: ms(v.inp), tone: tone(v.inp, 200, 500) },
          { label: "Layout shift", value: v.cls === null ? "–" : v.cls.toFixed(2), tone: tone(v.cls, 0.1, 0.25) },
        ])}`,
      )
      .join("")}
     ${sub("Errors")}${facts([
       { label: "Requests", value: worker ? fmt(worker.requests) : "–" },
       { label: "Crashes", value: worker ? fmt(worker.errors) : "–", tone: worker ? (worker.errors ? "poor" : "good") : undefined },
       { label: "Server errors", value: fmt(site.serverErrors), tone: site.serverErrors ? "poor" : "good" },
     ])}`,
    "Page speed is what 3 in 4 real visitors got or better: green is good, amber needs work, red is poor. Crashes are requests the Worker failed on; server errors are ones the site caught and answered with an error.",
  )}
`,
  );
}

/** The page around the stats or the sign-in form: the dark board header, then the content. */
export function pageShell(header: string, main: string, signOut = true): string {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
  <div class="top"><span class="eyebrow">somewhere🎉 · ${esc(now)}</span>${
    signOut ? `<form method="post" action="${STATS_PATH}"><button class="link" name="action" value="signout">Sign out</button></form>` : ""
  }</div>
  <h1>Stats</h1>
  ${header}
</header>
<main>
${main}
</main>
</body>
</html>`;
}

const STYLES = `
@font-face { font-family: "Inter"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("/fonts/inter-var-latin.woff2") format("woff2"); }
@font-face { font-family: "DM Mono"; font-style: normal; font-weight: 500; font-display: swap; src: url("/fonts/dm-mono-500-latin.woff2") format("woff2"); }
:root {
  --bg: #f6f7f5; --surface: #ffffff; --surface-2: #eef2ef; --text: #1c2421; --muted: #66716c; --border: #dde3df;
  --accent: #0f766e; --accent-soft: #d5efeb; --accent-text: #ffffff; --danger: #c2410c; --gold: #d97706; --gold-soft: #fdf0dc;
  --board: #1c2421; --board-line: #2c3833; --board-muted: #96a29c; --board-lit: #2dd4bf; --on-bright: #052e2a;
  --shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 4px 16px rgb(0 0 0 / 0.05);
  --mono: "DM Mono", ui-monospace, Menlo, monospace;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1412; --surface: #18201d; --surface-2: #212b27; --text: #e7ece9; --muted: #96a29c; --border: #2c3833;
    --accent: #2dd4bf; --accent-soft: #123b36; --accent-text: #052e2a; --danger: #fb923c; --gold: #fbbf24; --gold-soft: #3a2a0c; --board: #0a0e0c; --board-line: #26302c;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4);
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 400 1rem/1.45 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.board { background: var(--board); color: #fff; padding: calc(env(safe-area-inset-top) + 14px) 16px 16px; }
.board .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.board form { margin: 0; }
button.link { background: none; border: 0; padding: 0; color: var(--board-muted); font: 500 0.7rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
.signin { display: grid; gap: 12px; }
.signin label { font-weight: 600; }
.signin input { font: inherit; font-size: 1.1rem; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); color: var(--text); width: 100%; }
.signin input.code { font-family: var(--mono); font-size: 1.6rem; letter-spacing: 0.3em; text-align: center; }
.signin button { font: 600 1rem/1 Inter, system-ui, sans-serif; padding: 14px; border-radius: 10px; border: 0; background: var(--accent); color: var(--accent-text); cursor: pointer; }
.signin .again { background: none; color: var(--accent); padding: 4px; font-weight: 500; }
.error { margin: 0; color: var(--danger); font-weight: 500; }
.eyebrow { font: 500 0.7rem/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--board-muted); }
h1 { font-size: 2rem; letter-spacing: -0.02em; margin: 10px 0 14px; }
.seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--board-line); padding: 4px; border-radius: 10px; }
.seg a { text-align: center; padding: 8px 0; border-radius: 7px; color: var(--board-muted); text-decoration: none; font: 500 0.8rem/1 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; }
.seg a[aria-current] { background: var(--board-lit); color: var(--on-bright); }
main { max-width: 640px; margin: 0 auto; padding: 16px 16px calc(env(safe-area-inset-bottom) + 32px); display: grid; gap: 14px; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); padding: 12px; display: grid; gap: 2px; min-width: 0; }
.tile .label { font: 500 0.7rem/1.2 var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.tile b { font-size: 1.6rem; line-height: 1.1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
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
.funnel li { display: grid; grid-template-columns: 8.5rem 1fr auto; align-items: center; gap: 10px; font-size: 0.9rem; }
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
.tile .recent, .tile .chg { margin-right: 4px; }
.tile .recent:not(.up) { background: none; padding: 3px 0; }
.tile { align-content: start; }
.chg { display: inline-block; font: 500 0.75rem/1 var(--mono); color: var(--muted); margin-left: 6px; white-space: nowrap; }
.tile .chg { margin-left: 0; margin-top: 4px; }
.chg.up { color: var(--accent); }
.chg.down { color: var(--danger); }
h3 { margin: 4px 0 -6px; font-size: 0.9rem; font-weight: 600; }
.rows small { color: var(--muted); font-size: 0.75rem; margin-left: 4px; }
.facts { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
.facts div { background: var(--surface-2); border-radius: 10px; padding: 10px 12px; display: grid; gap: 4px; }
.facts dt { font: 500 0.7rem/1.2 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.facts dd { margin: 0; font-size: 1.25rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.facts dd small { font-size: 0.75rem; font-weight: 500; color: var(--muted); }
.facts .good dd { color: var(--accent); }
.facts .ok dd { color: var(--gold); }
.facts .poor dd { color: var(--danger); }
.chart figcaption .chg { font-size: 0.75rem; }
`;
