import type { Env } from "./env";

/**
 * The stats page's numbers from Cloudflare: Web Analytics (visits, pages, where from, devices, page speed)
 * and the Worker's own request and error counts. Both need the CF_ANALYTICS_TOKEN and CF_ACCOUNT_ID secrets.
 * Cloudflare won't look back more than 13 weeks in one go, so there's no previous period for 90 days.
 */
const HOST = "somewhere.party";
const SCRIPT = "nexttrip";
const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

export interface Vitals {
  device: string;
  /** 75th percentile, in milliseconds. Null when there were no readings (Cloudflare sends 0 or -1). */
  lcp: number | null;
  inp: number | null;
  cls: number | null;
}

export interface Visits {
  /** Visits and page views per day, by date. */
  daily: Record<string, { visits: number; views: number }>;
  /** Visits in the period before, or null when Cloudflare can't look back that far. */
  prevVisits: number | null;
  /** Every page viewed, most first. */
  pages: { path: string; views: number }[];
  referrers: { host: string; visits: number }[];
  countries: { country: string; visits: number }[];
  devices: { device: string; visits: number }[];
  vitals: Vitals[];
}

export interface WorkerHealth {
  requests: number;
  errors: number;
}

const VISITS_QUERY = `query($account: String!, $since: Date!, $from: Date!, $host: String!) {
  viewer { accounts(filter: { accountTag: $account }) {
    daily: rumPageloadEventsAdaptiveGroups(limit: 200, filter: { date_geq: $from, requestHost: $host }, orderBy: [date_ASC]) {
      count sum { visits } dimensions { date } }
    pages: rumPageloadEventsAdaptiveGroups(limit: 1000, filter: { date_geq: $since, requestHost: $host }, orderBy: [count_DESC]) {
      count dimensions { requestPath } }
    referrers: rumPageloadEventsAdaptiveGroups(limit: 10, filter: { date_geq: $since, requestHost: $host, refererHost_neq: "" }, orderBy: [sum_visits_DESC]) {
      sum { visits } dimensions { refererHost } }
    countries: rumPageloadEventsAdaptiveGroups(limit: 8, filter: { date_geq: $since, requestHost: $host }, orderBy: [sum_visits_DESC]) {
      sum { visits } dimensions { countryName } }
    devices: rumPageloadEventsAdaptiveGroups(limit: 5, filter: { date_geq: $since, requestHost: $host }, orderBy: [sum_visits_DESC]) {
      sum { visits } dimensions { deviceType } }
    vitals: rumWebVitalsEventsAdaptiveGroups(limit: 5, filter: { date_geq: $since, requestHost: $host }) {
      count quantiles { largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 } dimensions { deviceType } }
  } }
}`;

const WORKER_QUERY = `query($account: String!, $since: Date!, $script: String!) {
  viewer { accounts(filter: { accountTag: $account }) {
    worker: workersInvocationsAdaptive(limit: 200, filter: { date_geq: $since, scriptName: $script }) {
      sum { requests errors } }
  } }
}`;

type Group = {
  count?: number;
  sum?: { visits?: number; requests?: number; errors?: number };
  quantiles?: Record<string, number>;
  dimensions?: Record<string, string>;
};

async function query(env: Env, q: string, variables: Record<string, string>): Promise<Record<string, Group[]> | null> {
  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ACCOUNT_ID) return null;
  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, variables: { account: env.CF_ACCOUNT_ID, ...variables } }),
    });
    const json = (await res.json()) as { data?: { viewer: { accounts: Record<string, Group[]>[] } }; errors?: unknown[] | null };
    const acc = json.data?.viewer.accounts[0];
    if (!res.ok || json.errors?.length || !acc) {
      console.warn("Cloudflare analytics query failed", res.status, JSON.stringify(json.errors ?? null).slice(0, 300));
      return null;
    }
    return acc;
  } catch {
    return null;
  }
}

const visitsOf = (g: Group) => g.sum?.visits ?? 0;

/** Null when the token isn't set or Cloudflare doesn't answer; the page says so and still shows the rest. */
export async function pageVisits(env: Env, since: string, prevSince: string | null): Promise<Visits | null> {
  const acc = await query(env, VISITS_QUERY, { since, from: prevSince ?? since, host: HOST });
  if (!acc) return null;
  const daily = Object.fromEntries(
    (acc.daily ?? []).filter((g) => g.dimensions!.date >= since).map((g) => [g.dimensions!.date, { visits: visitsOf(g), views: g.count ?? 0 }]),
  );
  return {
    daily,
    prevVisits: prevSince ? (acc.daily ?? []).filter((g) => g.dimensions!.date < since).reduce((n, g) => n + visitsOf(g), 0) : null,
    pages: (acc.pages ?? []).map((g) => ({ path: g.dimensions!.requestPath, views: g.count ?? 0 })),
    referrers: acc.referrers
      .filter((g) => g.dimensions!.refererHost !== HOST && visitsOf(g) > 0)
      .map((g) => ({ host: g.dimensions!.refererHost.replace(/^www\./, ""), visits: visitsOf(g) })),
    countries: (acc.countries ?? []).map((g) => ({ country: g.dimensions!.countryName, visits: visitsOf(g) })),
    devices: (acc.devices ?? []).map((g) => ({ device: g.dimensions!.deviceType, visits: visitsOf(g) })),
    // Cloudflare gives times in microseconds.
    vitals: (acc.vitals ?? []).map((g) => {
      const q = (name: string, scale: number) => {
        const v = g.quantiles?.[name];
        return v && v > 0 ? (scale === 1 ? v : Math.round(v / scale)) : null;
      };
      return {
        device: g.dimensions!.deviceType,
        lcp: q("largestContentfulPaintP75", 1000),
        inp: q("interactionToNextPaintP75", 1000),
        cls: g.quantiles?.cumulativeLayoutShiftP75 !== undefined && g.quantiles.cumulativeLayoutShiftP75 >= 0 ? g.quantiles.cumulativeLayoutShiftP75 : null,
      };
    }),
  };
}

/** How many requests the Worker answered, and how many ended in an uncaught error. */
export async function workerHealth(env: Env, since: string): Promise<WorkerHealth | null> {
  const acc = await query(env, WORKER_QUERY, { since, script: SCRIPT });
  if (!acc) return null;
  return (acc.worker ?? []).reduce((t, g) => ({ requests: t.requests + (g.sum?.requests ?? 0), errors: t.errors + (g.sum?.errors ?? 0) }), { requests: 0, errors: 0 });
}
