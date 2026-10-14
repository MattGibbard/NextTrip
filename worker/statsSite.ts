import { cleanFilters } from "../shared/roundFilters";
import { BOOK_KINDS, BOOK_PLACES } from "./counters";

/**
 * The stats page's numbers from the site's own database. Family 1 is the owner's own and is left out
 * of everything. "Recent" is the chosen period and "prev" the same length of time before it.
 */
export interface Total {
  label: string;
  total: number;
  recent: number | null;
  prev: number | null;
}

export interface Period {
  current: number;
  prev: number;
}

export interface SiteNumbers {
  totals: Total[];
  active: { week: number; period: number };
  /** New families per day, by date. */
  signups: Record<string, number>;
  /** Of the families that joined in the period, how far each has got. */
  funnel: { families: number; welcomed: number; withIdea: number; invited: number; withDraw: number };
  signin: { emails: Period; done: Period };
  book: { total: Period; kinds: Record<string, number>; places: Record<string, number> };
  serverErrors: number;
  familySizes: { size: string; families: number }[];
  draws: { total: number; dates: number; filters: number; swipes: number };
  plans: { won: number; planned: number; items: number; booked: number };
  places: { name: string; country: string; families: number }[];
  countries: { country: string; families: number }[];
}

type R = Record<string, number | string | null>;

export async function siteNumbers(db: D1Database, since: string, prevSince: string): Promise<SiteNumbers> {
  const both = (sql: string) => db.prepare(sql).bind(since, prevSince);
  const results = await db.batch<R>([
    both("SELECT COUNT(*) AS total, SUM(created_at >= ?1) AS recent, SUM(created_at >= ?2 AND created_at < ?1) AS prev FROM families WHERE id != 1"),
    both("SELECT COUNT(*) AS total, SUM(created_at >= ?1) AS recent, SUM(created_at >= ?2 AND created_at < ?1) AS prev FROM people WHERE family_id != 1 AND removed = 0"),
    both("SELECT COUNT(*) AS total, SUM(created_at >= ?1) AS recent, SUM(created_at >= ?2 AND created_at < ?1) AS prev FROM ideas WHERE family_id != 1"),
    both("SELECT COUNT(*) AS total, SUM(created_at >= ?1) AS recent, SUM(created_at >= ?2 AND created_at < ?1) AS prev FROM trips WHERE family_id != 1"),
    both("SELECT COUNT(*) AS total, SUM(drawn_at >= ?1) AS recent, SUM(drawn_at >= ?2 AND drawn_at < ?1) AS prev FROM rounds WHERE family_id != 1 AND status = 'drawn'"),
    db.prepare("SELECT COUNT(*) AS total FROM plans WHERE family_id != 1"),
    db.prepare("SELECT SUM(last_seen_at >= datetime('now', '-7 days')) AS week, SUM(last_seen_at >= ?) AS period FROM families WHERE id != 1").bind(since),
    db.prepare("SELECT date(created_at) AS day, COUNT(*) AS n FROM families WHERE id != 1 AND created_at >= ? GROUP BY day").bind(since),
    db.prepare(
      `SELECT COUNT(*) AS families,
        SUM(EXISTS (SELECT 1 FROM people p WHERE p.family_id = f.id AND p.onboarded = 1)) AS welcomed,
        SUM(EXISTS (SELECT 1 FROM ideas i WHERE i.family_id = f.id)) AS withIdea,
        SUM((SELECT COUNT(*) FROM people p WHERE p.family_id = f.id AND p.removed = 0) >= 2) AS invited,
        SUM(EXISTS (SELECT 1 FROM rounds r WHERE r.family_id = f.id AND r.status = 'drawn')) AS withDraw
       FROM families f WHERE f.id != 1 AND f.created_at >= ?`,
    ).bind(since),
    both(
      `SELECT name, SUM(CASE WHEN day >= ?1 THEN n ELSE 0 END) AS current, SUM(CASE WHEN day < ?1 THEN n ELSE 0 END) AS prev
       FROM stat_counts WHERE day >= ?2 GROUP BY name`,
    ),
    db.prepare(
      `SELECT size, COUNT(*) AS families FROM (
         SELECT (SELECT COUNT(*) FROM people p WHERE p.family_id = f.id AND p.removed = 0) AS size FROM families f WHERE f.id != 1
       ) GROUP BY size ORDER BY size`,
    ),
    db.prepare("SELECT filters, trip_dates, swipe FROM rounds WHERE family_id != 1 AND status = 'drawn'"),
    db.prepare(
      `SELECT (SELECT COUNT(*) FROM rounds WHERE family_id != 1 AND status = 'drawn' AND winner_idea_id IS NOT NULL) AS won,
        (SELECT COUNT(*) FROM plans WHERE family_id != 1) AS planned,
        (SELECT COUNT(*) FROM plan_items WHERE family_id != 1) AS items,
        (SELECT COUNT(*) FROM plan_items WHERE family_id != 1 AND status = 'booked') AS booked`,
    ),
    db.prepare(
      `SELECT MIN(ip.name) AS name, ip.country_code AS country, COUNT(DISTINCT i.family_id) AS families
       FROM idea_places ip JOIN ideas i ON i.id = ip.idea_id WHERE i.family_id != 1
       GROUP BY lower(ip.name), ip.country_code ORDER BY families DESC, COUNT(*) DESC LIMIT 10`,
    ),
    db.prepare(
      `SELECT ip.country_code AS country, COUNT(DISTINCT i.family_id) AS families
       FROM idea_places ip JOIN ideas i ON i.id = ip.idea_id WHERE i.family_id != 1
       GROUP BY ip.country_code ORDER BY families DESC, COUNT(*) DESC LIMIT 8`,
    ),
  ]);
  const [families, people, ideas, trips, draws, plans, active, signups, funnel, counts, sizes, rounds, planRow, places, countries] = results;
  const row = (r: D1Result<R>) => r.results[0] ?? {};
  const num = (v: unknown) => Number(v ?? 0);
  const total = (label: string, r: D1Result<R>, recent = true): Total => ({
    label,
    total: num(row(r).total),
    recent: recent ? num(row(r).recent) : null,
    prev: recent ? num(row(r).prev) : null,
  });

  const counted = new Map(counts.results.map((r) => [String(r.name), { current: num(r.current), prev: num(r.prev) }]));
  const count = (name: string): Period => counted.get(name) ?? { current: 0, prev: 0 };
  const book = { total: { current: 0, prev: 0 }, kinds: {} as Record<string, number>, places: {} as Record<string, number> };
  for (const kind of BOOK_KINDS) {
    for (const place of BOOK_PLACES) {
      const c = count(`book:${kind}:${place}`);
      book.total.current += c.current;
      book.total.prev += c.prev;
      book.kinds[kind] = (book.kinds[kind] ?? 0) + c.current;
      book.places[place] = (book.places[place] ?? 0) + c.current;
    }
  }

  const drawn = rounds.results.map((r) => ({ filters: cleanFilters(r.filters), dates: !!r.trip_dates, swipe: num(r.swipe) === 1 }));
  const sizeRows = sizes.results.map((r) => ({ size: num(r.size), families: num(r.families) }));
  const bigger = sizeRows.filter((r) => r.size >= 5).reduce((n, r) => n + r.families, 0);
  const p = row(planRow);
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
    active: { week: num(row(active).week), period: num(row(active).period) },
    signups: Object.fromEntries(signups.results.map((r) => [String(r.day), num(r.n)])),
    funnel: { families: num(f.families), welcomed: num(f.welcomed), withIdea: num(f.withIdea), invited: num(f.invited), withDraw: num(f.withDraw) },
    signin: { emails: count("signin_email"), done: count("signin_done") },
    book,
    serverErrors: count("error_500").current,
    familySizes: [
      ...sizeRows.filter((r) => r.size < 5).map((r) => ({ size: r.size === 1 ? "1 person" : `${r.size} people`, families: r.families })),
      ...(bigger ? [{ size: "5 or more", families: bigger }] : []),
    ],
    draws: {
      total: drawn.length,
      dates: drawn.filter((d) => d.dates).length,
      filters: drawn.filter((d) => Object.values(d.filters).some((v) => v.length > 0)).length,
      swipes: drawn.filter((d) => d.swipe).length,
    },
    plans: { won: num(p.won), planned: num(p.planned), items: num(p.items), booked: num(p.booked) },
    places: places.results.map((r) => ({ name: String(r.name), country: String(r.country), families: num(r.families) })),
    countries: countries.results.map((r) => ({ country: String(r.country), families: num(r.families) })),
  };
}
