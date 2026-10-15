import { useEffect, useState } from "react";
import { LONDON, countryFlag, flightHoursTo } from "../destinations";
import { destinationPath } from "../../shared/seo";
import { NEAR_HOURS, alsoGood, hotList, hubGuides, hubIcon } from "../hubs";
import type { Hub } from "../hubs";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { AppBottomNav, AppTopbar } from "../components/AppNav";
import { PostCards } from "../components/PostCards";
import { postsAboutHub } from "../blog";
import { GuideCard, HubLinks, Label, MONTH_NAMES, bestSet, useFamily } from "./DestinationPage";
import type { Family } from "./DestinationPage";

/** How many places each month lists in "When to go", before "and N more". */
const PER_MONTH = 8;
/** How many guide cards show at first, and how many more each "Show more guides" adds, as on the Inspire page. */
const BATCH = 24;

/**
 * A hub: every guide for one kind of holiday or one country, with what's good in each month and the
 * hub's own questions. A month's page lists the guides at their best that month, then the ones that
 * are good then too. The prerendered page lists the guides A to Z; once the page is up, the ones at
 * their best this month move to the front, as on the Inspire page. Cards come in batches, so every
 * guide is also linked in a short A to Z list, for people and search engines alike.
 */
export function HubPage({ hub, family }: { hub: Hub; family?: Family }) {
  const { signedIn, me, ideas, airport } = useFamily(family);
  const from = airport?.code && airport.lat !== null ? { code: airport.code, name: airport.name, lat: airport.lat, lon: airport.lon } : LONDON;
  const [month, setMonth] = useState<number | null>(null);
  const [showing, setShowing] = useState(BATCH);
  // A month's page, or a collection with a month, is always about that month; the others look at this month once the page is up.
  const own = hub.kind === "month" || hub.kind === "collection" ? hub.month : null;
  useEffect(() => setMonth(own ?? new Date().getMonth()), [own]);
  const shown = own ?? month;

  const guides = hubGuides(hub);
  const best = new Map(guides.map((d) => [d.slug, bestSet(d)]));
  const inSeason = (slug: string) => shown !== null && (own !== null || !!best.get(slug)?.has(shown));
  const cards = [...guides.filter((d) => inSeason(d.slug)), ...guides.filter((d) => !inSeason(d.slug))];
  const board = guides.filter((d) => inSeason(d.slug));
  const icon = hubIcon(hub);
  const also = alsoGood(hub);
  const onList = (name: string) => ideas?.find((i) => i.status === "active" && i.title.trim().toLowerCase() === name.toLowerCase());

  return (
    <div className={`lp dg dx hb ${signedIn ? "dg-app" : ""}`}>
      {signedIn ? <AppTopbar current="guides" me={me} /> : <SiteHeader current="inspire" />}

      <main>
        <section className="lp-wrap dx-hero">
          <div className="dx-hero-text">
            <nav aria-label="Breadcrumb" className="dg-crumbs">
              {!signedIn && (
                <>
                  <a href="/">Home</a>
                  <span aria-hidden>›</span>
                </>
              )}
              <a href="/destinations">Inspire</a>
              <span aria-hidden>›</span>
              <span aria-current="page">{hub.name}</span>
            </nav>
            <Label>{`${icon} ${hub.kind === "type" ? "HOLIDAY TYPE" : hub.kind === "month" ? "WHEN TO GO" : hub.kind === "collection" ? "HOLIDAY IDEAS" : "COUNTRY"}`.trim()}</Label>
            <h1>{hub.title}</h1>
            {hub.intro && <p className="dg-intro">{hub.intro}</p>}
          </div>

          <aside className="dx-board" aria-label={shown === null ? hub.name : `Good to go in ${MONTH_NAMES[shown]}`}>
            <div className="dx-board-head">
              <span className="lit">{shown === null ? `${guides.length} GUIDES` : `GOOD TO GO IN ${MONTH_NAMES[shown].toUpperCase()}`}</span>
              <span>{from === LONDON ? "FROM THE UK" : `FROM ${from.code}`}</span>
            </div>
            <ul>
              {(shown === null ? guides : board).slice(0, 5).map((d) => {
                const hours = flightHoursTo(from, d);
                return (
                  <li key={d.slug}>
                    <span className="lit">{d.to_code}</span>
                    <a href={destinationPath(d.slug)}>{d.name.toUpperCase()}</a>
                    <span>{hours !== null && `✈️ ${hours}H`}</span>
                  </li>
                );
              })}
            </ul>
            <p>
              {shown !== null && board.length === 0
                ? "Nothing here is at its best this shown. See when to go below."
                : shown !== null && board.length > 5
                  ? `And ${board.length - 5} more below.`
                  : "See every guide below."}
            </p>
          </aside>
        </section>

        {hub.kind === "month" && hub.month !== null && <HotList hub={hub} from={from} />}

        <section className="lp-wrap dx-section" aria-labelledby="hb-guides">
          <div className="dx-section-head">
            <h2 id="hb-guides">
              {hub.title}: {guides.length} {guides.length === 1 ? "guide" : "guides"}
            </h2>
            {month !== null && own === null && (
              <p className="muted small">
                {board.length} of {guides.length} {board.length === 1 && guides.length === 1 ? "is" : "are"} good in {MONTH_NAMES[month]}
              </p>
            )}
          </div>
          <div className="dx-grid">
            {cards.slice(0, showing).map((d) => (
              <GuideCard key={d.slug} d={d} from={from} month={own === null ? month : null} best={best.get(d.slug)!} idea={onList(d.name)} signedIn={signedIn} />
            ))}
          </div>
          {cards.length > showing && (
            <div className="dx-more">
              <p className="muted small">
                Showing {showing} of {cards.length} guides
              </p>
              <button type="button" className="btn ghost" onClick={() => setShowing(showing + BATCH)}>
                Show more guides
              </button>
            </div>
          )}
          {guides.length > BATCH && (
            <nav aria-label={`Every guide, A to Z`} className="hb-az">
              <p className="dx-filter-label">Every guide, A to Z</p>
              <ul>
                {guides.map((d) => (
                  <li key={d.slug}>
                    <a href={destinationPath(d.slug)}>{d.name}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>

        {own !== null && also.length > 0 && (
          <section className="lp-wrap dx-section hb-also" aria-labelledby="hb-also">
            <h2 id="hb-also">Also good in {MONTH_NAMES[own]}</h2>
            <p className="muted">Not quite at their best, but still a good time to go.</p>
            <ul>
              {also.map((d) => (
                <li key={d.slug}>
                  <a href={destinationPath(d.slug)}>{d.name}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {own === null && (
        <section className="lp-wrap dx-section" aria-labelledby="hb-when">
          <h2 id="hb-when">When to go</h2>
          <p className="muted">Where's at its best in each month of the year.</p>
          <dl className="hb-months">
            {MONTH_NAMES.map((name, i) => {
              const good = guides.filter((d) => best.get(d.slug)?.has(i));
              const more = good.length - PER_MONTH;
              return (
                <div key={name} className={month === i ? "now" : ""}>
                  <dt>{name}</dt>
                  <dd>
                    {good.length === 0 ? (
                      <span className="muted">Nowhere here is at its best.</span>
                    ) : (
                      <>
                        {good.slice(0, PER_MONTH).map((d, k) => (
                          <span key={d.slug}>
                            {k > 0 && ", "}
                            <a href={destinationPath(d.slug)}>{d.name}</a>
                          </span>
                        ))}
                        {more > 0 && <span className="muted"> and {more} more</span>}
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
        )}

        {hub.faqs.length > 0 && (
          <section className="lp-wrap dx-section" aria-labelledby="hb-faq">
            <h2 id="hb-faq">{hub.title}: common questions</h2>
            <div className="dg-faqs">
              {hub.faqs.map((f, i) => (
                <details key={f.question} open={i === 0}>
                  <summary>
                    {f.question}
                    <span aria-hidden>+</span>
                  </summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <PostCards posts={postsAboutHub(hub.slug, guides.map((g) => g.slug), 3)} heading="From the blog" id="hb-blog" className="dx-section" />

        <HubLinks kind="type" heading={hub.kind === "type" ? "Other kinds of holiday" : "Browse by holiday type"} except={hub.slug} />
        <HubLinks kind="month" heading={hub.kind === "month" ? "Other months" : "Browse by month"} except={hub.slug} />
        <HubLinks kind="collection" heading={hub.kind === "collection" ? "More holiday ideas" : "Holiday ideas"} except={hub.slug} />
        <HubLinks kind="country" heading={hub.kind === "country" ? "Other countries" : "Browse by country"} except={hub.slug} />

        {!signedIn && (
          <section className="lp-wrap dx-section">
            <div className="dx-cta">
              <div>
                <span className="dx-cta-label">🎟️ IDEAS ON STANDBY</span>
                <h2>Found somewhere you like?</h2>
                <p className="muted">Put it on standby with the rest of your family's ideas. Everyone spreads their points in secret, gets one veto, and the draw picks where you go.</p>
              </div>
              <div className="dx-cta-actions">
                <a className="btn" href="/#signin">
                  Start planning
                </a>
                <a href="/destinations">All destination guides</a>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter signedIn={signedIn} />
      {signedIn && <AppBottomNav current="guides" />}
    </div>
  );
}

/**
 * A month page's answer to "where is hot in…": the warmest places that are good that month, near and
 * further away, with their average daytime high. The sentence on top is the short answer.
 */
function HotList({ hub, from }: { hub: Hub; from: { code: string; lat: number | null; lon: number | null } }) {
  const { near, far } = hotList(hub, from);
  if (!near.length && !far.length) return null;
  const month = MONTH_NAMES[hub.month!];
  const top = (rows: typeof near) => rows.slice(0, 3).map((r) => `${r.d.name} (${r.temp}°C)`);
  const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
  const fromName = from === LONDON ? "the UK" : from.code;
  const groups = [
    { key: "near", title: `Within ${NEAR_HOURS} hours of ${fromName}`, rows: near },
    { key: "far", title: "Further away", rows: far },
  ].filter((g) => g.rows.length);
  return (
    <section className="lp-wrap dx-section hb-hot" aria-labelledby="hb-hot">
      <div className="dx-section-head">
        <h2 id="hb-hot">Where&rsquo;s hot in {month}?</h2>
      </div>
      <p className="hb-hot-answer">
        {near.length > 0 && <>Within a {NEAR_HOURS}-hour flight of {fromName}, the warmest places that are good in {month} are {list(top(near))}. </>}
        {far.length > 0 && <>Further away, try {list(top(far))}.</>}
      </p>
      <div className="hb-hot-groups">
        {groups.map((g) => (
          <div key={g.key} className="hb-hot-group">
            <h3>{g.title}</h3>
            <ol>
              {g.rows.map((r) => (
                <li key={r.d.slug}>
                  <a href={destinationPath(r.d.slug)}>
                    <span aria-hidden>{countryFlag(r.d.country_code)} </span>
                    {r.d.name}
                  </a>
                  <span className="muted small">{r.hours !== null && `✈️ ${r.hours}h`}</span>
                  <span className="hb-hot-temp">{r.temp}°C</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="muted small">Average daytime highs. Every place here is rated best or good to visit in {month}.</p>
    </section>
  );
}

