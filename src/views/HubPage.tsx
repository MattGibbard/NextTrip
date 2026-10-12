import { useEffect, useState } from "react";
import { LONDON, countryFlag, flightHoursTo } from "../destinations";
import { HOLIDAY_TYPES } from "../../shared/ideaDetails";
import { destinationPath } from "../../shared/seo";
import { hubGuides } from "../hubs";
import type { Hub } from "../hubs";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { AppBottomNav, AppTopbar } from "../components/AppNav";
import { GuideCard, HubLinks, Label, MONTH_NAMES, bestSet, useFamily } from "./DestinationPage";
import type { Family } from "./DestinationPage";

/** How many places each month lists in "When to go", before "and N more". */
const PER_MONTH = 8;
/** How many guide cards show at first, and how many more each "Show more guides" adds, as on the Inspire page. */
const BATCH = 24;

/**
 * A hub: every guide for one kind of holiday or one country, with what's good in each month and the
 * hub's own questions. The prerendered page lists the guides A to Z; once the page is up, the ones at
 * their best this month move to the front, as on the Inspire page. Cards come in batches, so every
 * guide is also linked in a short A to Z list, for people and search engines alike.
 */
export function HubPage({ hub, family }: { hub: Hub; family?: Family }) {
  const { signedIn, me, ideas, airport } = useFamily(family);
  const from = airport?.code && airport.lat !== null ? { code: airport.code, name: airport.name, lat: airport.lat, lon: airport.lon } : LONDON;
  const [month, setMonth] = useState<number | null>(null);
  const [showing, setShowing] = useState(BATCH);
  useEffect(() => setMonth(new Date().getMonth()), []);

  const guides = hubGuides(hub);
  const best = new Map(guides.map((d) => [d.slug, bestSet(d)]));
  const inSeason = (slug: string) => month !== null && !!best.get(slug)?.has(month);
  const cards = [...guides.filter((d) => inSeason(d.slug)), ...guides.filter((d) => !inSeason(d.slug))];
  const board = guides.filter((d) => inSeason(d.slug));
  const icon = hub.kind === "type" ? HOLIDAY_TYPES.find((t) => t.key === hub.holiday_type)?.icon : countryFlag(hub.country_code);
  const onList = (name: string) => ideas?.find((i) => i.status === "active" && i.title.trim().toLowerCase() === name.toLowerCase());

  return (
    <div className={`lp dg dx hb ${signedIn ? "dg-app" : ""}`}>
      {signedIn ? <AppTopbar current="guides" me={me} /> : <SiteHeader guide />}

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
            <Label>{`${icon ?? ""} ${hub.kind === "type" ? "HOLIDAY TYPE" : "COUNTRY"}`.trim()}</Label>
            <h1>{hub.title}</h1>
            {hub.intro && <p className="dg-intro">{hub.intro}</p>}
          </div>

          <aside className="dx-board" aria-label={month === null ? hub.name : `Good to go in ${MONTH_NAMES[month]}`}>
            <div className="dx-board-head">
              <span className="lit">{month === null ? `${guides.length} GUIDES` : `GOOD TO GO IN ${MONTH_NAMES[month].toUpperCase()}`}</span>
              <span>{from === LONDON ? "FROM THE UK" : `FROM ${from.code}`}</span>
            </div>
            <ul>
              {(month === null ? guides : board).slice(0, 5).map((d) => {
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
              {month !== null && board.length === 0
                ? "Nothing here is at its best this month. See when to go below."
                : month !== null && board.length > 5
                  ? `And ${board.length - 5} more below.`
                  : "See every guide below."}
            </p>
          </aside>
        </section>

        <section className="lp-wrap dx-section" aria-labelledby="hb-guides">
          <div className="dx-section-head">
            <h2 id="hb-guides">
              {hub.title}: {guides.length} {guides.length === 1 ? "guide" : "guides"}
            </h2>
            {month !== null && (
              <p className="muted small">
                {board.length} of {guides.length} {board.length === 1 && guides.length === 1 ? "is" : "are"} good in {MONTH_NAMES[month]}
              </p>
            )}
          </div>
          <div className="dx-grid">
            {cards.slice(0, showing).map((d) => (
              <GuideCard key={d.slug} d={d} from={from} month={month} best={best.get(d.slug)!} idea={onList(d.name)} signedIn={signedIn} />
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

        <HubLinks kind="type" heading={hub.kind === "type" ? "Other kinds of holiday" : "Browse by holiday type"} except={hub.slug} />
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
