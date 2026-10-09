import { useEffect, useState } from "react";
import type { Idea, Person } from "../../shared/types";
import type { Terminal } from "../../shared/terminals";
import { api } from "../api";
import { DESTINATIONS, LONDON, bestMonths, countryFlag, destinationNamed, flightHoursTo, flightTime, imageUrl, shortIntro } from "../destinations";
import type { Destination } from "../destinations";
import { HOLIDAY_TYPES, budgetLabel, holidayType, travelTimeLabel } from "../../shared/ideaDetails";
import { destinationPath } from "../../shared/seo";
import { SiteFooter, SiteHeader } from "./Welcome";
import { AppBottomNav, AppTopbar } from "../components/AppNav";

/**
 * Who's looking. Starts as a visitor, the same as the prerendered page, then checks for a signed-in
 * family once the page is up so it can offer "Add to ideas" and show their ideas alongside. Inside the
 * signed-in app the family is already known and handed in, so nothing needs checking.
 */
export interface Family {
  signedIn: boolean;
  /** Who's using this device, for the header. */
  me: Person | null;
  ideas: Idea[] | null;
  /** The family's home airport, which flight times are worked out from instead of London. */
  airport: Terminal | null;
}

function useFamily(given?: Family): Family {
  const [state, setState] = useState<Family>({ signedIn: false, me: null, ideas: null, airport: null });
  useEffect(() => {
    if (given) return;
    let live = true;
    void api
      .session()
      .then(async (s) => {
        if (!s.signed_in || !live) return;
        setState({ signedIn: true, me: null, ideas: null, airport: null });
        const [ideas, home, people] = await Promise.all([api.ideas(), api.homeEnds().catch(() => null), api.people().catch(() => [])]);
        const me = people.find((p) => p.id === s.person_id && !p.removed) ?? null;
        if (live) setState({ signedIn: true, me, ideas, airport: home?.airport ?? null });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return given ?? state;
}

function Label({ children }: { children: string }) {
  return <span className="dg-label">{children}</span>;
}

/** A destination guide, for visitors finding it in search and for signed-in families looking for ideas. */
export function DestinationPage({ destination: d, family }: { destination: Destination; family?: Family }) {
  const { signedIn, me, ideas, airport } = useFamily(family);
  const from = airport?.code && airport.lat !== null ? { code: airport.code, name: airport.name, lat: airport.lat, lon: airport.lon } : LONDON;
  const flight = flightTime(from, d);
  const best = bestMonths(d);
  const facts = [...(flight ? [{ label: `Flight from ${from.name}`, value: flight, highlight: true }] : []), ...d.facts];
  const onList = ideas?.find((i) => i.status === "active" && i.title.trim().toLowerCase() === d.name.toLowerCase());
  const standby = ideas?.filter((i) => i.status === "active" && i !== onList).slice(0, 3) ?? [];
  const types = d.holiday_types.map(holidayType).filter((t) => !!t);

  return (
    <div className={`lp dg ${signedIn ? "dg-app" : ""}`}>
      {signedIn ? <AppTopbar current="guides" me={me} /> : <SiteHeader guide />}

      <main className="lp-wrap dg-main">
        <div className="dg-top">
          <nav aria-label="Breadcrumb" className="dg-crumbs">
            {!signedIn && (
              <>
                <a href="/">Home</a>
                <span aria-hidden>›</span>
              </>
            )}
            <a href="/destinations">Inspire</a>
            <span aria-hidden>›</span>
            <span aria-current="page">{d.name}</span>
          </nav>

          <section className="dg-hero">
            <article className="dg-ticket">
              <div className="dg-ticket-head">
                <span>{signedIn ? (onList ? "On your list" : "Not on your list yet") : "Destination guide"}</span>
                {d.country && <span>{d.country}</span>}
              </div>
              <div className="dg-ticket-body">
                {d.to_code && (
                  <div className="dg-route">
                    <div>
                      <Label>FROM</Label>
                      <span className="dg-code">{from.code}</span>
                    </div>
                    <div className="dg-route-line">{flight && <span>{flight.toUpperCase()} ✈️</span>}</div>
                    <div className="end">
                      <Label>TO</Label>
                      <span className="dg-code">{d.to_code}</span>
                    </div>
                  </div>
                )}
                <h1>{d.title}</h1>
                {d.intro && <p className="dg-intro">{d.intro}</p>}
              </div>
              <div className="dg-perf" />
              <div className="dg-facts">
                {types.length > 0 && (
                  <div>
                    <Label>BEST FOR</Label>
                    <strong>{types.map((t) => `${t.icon} ${t.label}`).join(", ")}</strong>
                  </div>
                )}
                {d.nights && (
                  <div>
                    <Label>NIGHTS AWAY</Label>
                    <strong>{d.nights}</strong>
                  </div>
                )}
                {d.budget && (
                  <div>
                    <Label>BUDGET</Label>
                    <strong>{budgetLabel(d.budget)}</strong>
                  </div>
                )}
                {best && (
                  <div>
                    <Label>BEST MONTHS</Label>
                    <strong>{best}</strong>
                  </div>
                )}
              </div>
              <div className="dg-actions">
                {signedIn ? (
                  <>
                    {onList ? (
                      <a className="btn dg-btn" href={`/#/next/${onList.id}`}>
                        See it in your ideas
                      </a>
                    ) : (
                      <a className="btn dg-btn" href={`/#/next/add/${d.slug}`}>
                        Add to ideas
                      </a>
                    )}
                    <a className="btn ghost dg-btn" href={`/#/been/add/${d.slug}`}>
                      We've been! Add trip
                    </a>
                  </>
                ) : (
                  <>
                    <a className="btn dg-btn" href="/#signin">
                      Add {d.name} to your ideas
                    </a>
                    <span className="muted small">Free. One email per family.</span>
                  </>
                )}
              </div>
            </article>

            {d.image ? (
              <img className="dg-photo" src={imageUrl(d.image)} alt={d.image_alt} fetchPriority="high" />
            ) : (
              <div className="dg-photo dg-photo-empty" aria-hidden>
                <span>{d.to_code || d.name}</span>
              </div>
            )}
          </section>
        </div>

        {signedIn && ideas && (
          <section aria-labelledby="dg-standby" className="dg-standby">
            <div className="dg-standby-head">
              <h2 id="dg-standby">{onList ? "With your other ideas on standby" : "Next to your ideas on standby"}</h2>
              <a href="/#/next">See all ideas</a>
            </div>
            <div className="dg-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>IDEA</th>
                    <th>TYPE</th>
                    <th>BUDGET</th>
                    <th>TRAVEL TIME</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="here">
                    <td>
                      {d.name} <span className="dg-here">· this page</span>
                    </td>
                    <td>{types[0] ? `${types[0].icon} ${types[0].label}` : ""}</td>
                    <td>{budgetLabel(d.budget) ?? ""}</td>
                    <td>{flight ? `✈️ ${flight}` : ""}</td>
                  </tr>
                  {standby.map((i) => {
                    const t = i.holiday_types.map(holidayType).find((x) => !!x);
                    return (
                      <tr key={i.id}>
                        <td>
                          <a href={`/#/next/${i.id}`}>{i.title}</a>
                        </td>
                        <td>{t ? `${t.icon} ${t.label}` : ""}</td>
                        <td>{budgetLabel(i.budget) ?? ""}</td>
                        <td>{travelTimeLabel(i.travel_time) ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!onList && <p className="muted small">Add it and {d.name} gets a seat in your next draw.</p>}
          </section>
        )}

        {facts.length > 0 && (
          <section aria-labelledby="dg-facts" className="dg-section">
            <h2 id="dg-facts">{d.name} at a glance</h2>
            <dl className="dg-board">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label.toUpperCase()}</dt>
                  <dd className={f.highlight ? "lit" : ""}>{f.value.toUpperCase()}</dd>
                </div>
              ))}
            </dl>
            {d.facts_note && <p className="muted small">{d.facts_note}</p>}
          </section>
        )}

        {d.months.some((m) => m.note) && (
          <section aria-labelledby="dg-when" className="dg-section">
            <div className="dg-when-head">
              <h2 id="dg-when">When to go</h2>
              <div className="dg-key" aria-hidden>
                <span>
                  <i className="best" />
                  Best
                </span>
                <span>
                  <i className="good" />
                  Good
                </span>
                <span>
                  <i className="quiet" />
                  Quieter
                </span>
              </div>
            </div>
            <ol className="dg-months">
              {d.months.map((m) => (
                <li key={m.code} className={m.rating}>
                  <span className="dg-month">{m.code}</span>
                  <span className="dg-month-note">
                    {m.note}
                    <span className="visually-hidden">, {m.rating === "best" ? "best time to go" : m.rating === "good" ? "a good time to go" : "quieter"}</span>
                  </span>
                </li>
              ))}
            </ol>
            {d.when_to_go && <p className="dg-prose">{d.when_to_go}</p>}
          </section>
        )}

        {d.things.length > 0 && (
          <section aria-labelledby="dg-todo" className="dg-section">
            <h2 id="dg-todo">Things to do with the family</h2>
            <div className="dg-things">
              {d.things.map((t) => (
                <article key={t.name} className="dg-thing">
                  {t.image && <img src={imageUrl(t.image)} alt={t.image_alt} loading="lazy" />}
                  <div className="dg-thing-body">
                    {t.tag && <span className="dg-tag">{t.tag.toUpperCase()}</span>}
                    <h3>{t.name}</h3>
                    {t.blurb && <p className="muted">{t.blurb}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {d.faqs.length > 0 && (
          <section aria-labelledby="dg-faq" className="dg-section">
            <h2 id="dg-faq">{d.name}: common questions</h2>
            <div className="dg-faqs">
              {d.faqs.map((f, i) => (
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

        {d.similar.length > 0 && (
          <section aria-labelledby="dg-similar" className="dg-section">
            <h2 id="dg-similar">{signedIn ? "More ideas like this" : `If you like ${d.name}`}</h2>
            <div className="dg-similar">
              {d.similar.map((s) => {
                const guide = destinationNamed(s.name);
                const inner = (
                  <>
                    <span className="dg-similar-code">{s.code}</span>
                    <span>
                      <strong>{s.name}</strong>
                      {s.label && <span className="muted small">{s.label}</span>}
                    </span>
                  </>
                );
                return guide ? (
                  <a key={s.name} className="dg-similar-card" href={destinationPath(guide.slug)}>
                    {inner}
                  </a>
                ) : (
                  <div key={s.name} className="dg-similar-card">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!signedIn && (
          <section className="dg-cta">
            <div>
              <h2>Can't agree where to go next?</h2>
              <p>Put {d.name} on standby with everyone's other ideas. You each spread your points in secret, get one veto, and the draw picks where you go.</p>
            </div>
            <a className="btn dg-btn" href="/#signin">
              Start planning, it's free
            </a>
          </section>
        )}
      </main>

      <SiteFooter />
      {signedIn && <AppBottomNav current="guides" />}
    </div>
  );
}


const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonth = (i: number) => MONTH_NAMES[i].slice(0, 3);

/** Months a guide rates "best", by number (0 is January). */
function bestSet(d: Destination): Set<number> {
  return new Set(d.months.flatMap((m, i) => (m.rating === "best" ? [i] : [])));
}

/** A copy of the list in a random order (Fisher-Yates). */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Every guide, for browsing: a departures board of what's in season, filters for the month and kind
 * of holiday, a card per guide and the countries they're in. The month is the visitor's own, set once
 * the page is up so the prerendered page doesn't depend on when the site was built. The order is
 * shuffled then too, so each visit leads with different places while the prerendered page stays A to Z.
 */
export function DestinationsIndex({ family }: { family?: Family }) {
  const { signedIn, me, ideas, airport } = useFamily(family);
  const from = airport?.code && airport.lat !== null ? { code: airport.code, name: airport.name, lat: airport.lat, lon: airport.lon } : LONDON;
  const [month, setMonth] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState(DESTINATIONS);

  useEffect(() => {
    setMonth(new Date().getMonth());
    setOrder(shuffled(DESTINATIONS));
    const code = new URLSearchParams(location.search).get("country")?.toUpperCase();
    if (code && DESTINATIONS.some((d) => d.country_code === code)) setCountry(code);
  }, []);

  const best = new Map(DESTINATIONS.map((d) => [d.slug, bestSet(d)]));
  const inSeason = (d: Destination) => month !== null && !!best.get(d.slug)?.has(month);
  const types = HOLIDAY_TYPES.filter((t) => DESTINATIONS.some((d) => d.holiday_types.includes(t.key)));
  const words = search.trim().toLowerCase();
  const shown = order.filter(
    (d) =>
      (!type || d.holiday_types.includes(type as Destination["holiday_types"][number])) &&
      (!country || d.country_code === country) &&
      (!words || `${d.name} ${d.country}`.toLowerCase().includes(words)),
  );
  const cards = [...shown.filter(inSeason), ...shown.filter((d) => !inSeason(d))];
  const good = shown.filter(inSeason).length;
  const boardAll = month === null ? order : order.filter(inSeason);
  const board = boardAll.slice(0, 5);
  const boardMore = boardAll.length - board.length;

  const countries = [...new Set(DESTINATIONS.map((d) => d.country_code).filter(Boolean))]
    .map((code) => ({ code, name: DESTINATIONS.find((d) => d.country_code === code)!.country, count: DESTINATIONS.filter((d) => d.country_code === code).length }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  const pickCountry = (code: string | null) => {
    setCountry(code);
    const url = new URL(location.href);
    if (code) url.searchParams.set("country", code);
    else url.searchParams.delete("country");
    history.replaceState(null, "", url.pathname + url.search);
  };
  const clear = () => {
    setType(null);
    setSearch("");
    pickCountry(null);
  };

  const onList = (d: Destination) => ideas?.find((i) => i.status === "active" && i.title.trim().toLowerCase() === d.name.toLowerCase());
  const filtered = !!(type || country || words);

  return (
    <div className={`lp dg dx ${signedIn ? "dg-app" : ""}`}>
      {signedIn ? <AppTopbar current="guides" me={me} /> : <SiteHeader guide="index" />}

      <main>
        <section className="lp-wrap dx-hero">
          <div className="dx-hero-text">
            <Label>INSPIRE</Label>
            <h1>Holiday ideas</h1>
            <p className="dg-intro">When to go, how long to stay and what to do when you get there. Find somewhere new and put it on standby for your next draw.</p>
            <div className="dx-search">
              <label htmlFor="dx-search">Search destinations</label>
              <input id="dx-search" type="search" placeholder="A city, region or country" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {DESTINATIONS.length > 0 && (
            <aside className="dx-board" aria-label={month === null ? "Destination guides" : `Good to go in ${MONTH_NAMES[month]}`}>
              <div className="dx-board-head">
                <span className="lit">{month === null ? "DESTINATION GUIDES" : `GOOD TO GO IN ${MONTH_NAMES[month].toUpperCase()}`}</span>
                <span>{from === LONDON ? "FROM THE UK" : `FROM ${from.code}`}</span>
              </div>
              <ul>
                {board.map((d) => {
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
                {board.length === 0
                  ? "Nothing's at its best this month. Pick another month to see what's in season."
                  : boardMore > 0
                    ? `And ${boardMore} more below.`
                    : "Pick another month to see what else is in season."}
              </p>
            </aside>
          )}
        </section>

        <section className="lp-wrap" aria-label="Filter destinations">
          <div className="dx-filters">
            <div>
              <p className="dx-filter-label">When can you go?</p>
              <div role="group" aria-label="Month" className="dx-chips">
                {MONTH_NAMES.map((name, i) => (
                  <button key={name} type="button" aria-pressed={month === i} aria-label={name} onClick={() => setMonth(i)}>
                    {shortMonth(i)}
                  </button>
                ))}
              </div>
            </div>
            {types.length > 1 && (
              <div>
                <p className="dx-filter-label">Holiday type</p>
                <div role="group" aria-label="Holiday type" className="dx-chips">
                  <button type="button" aria-pressed={!type} onClick={() => setType(null)}>
                    All types
                  </button>
                  {types.map((t) => (
                    <button key={t.key} type="button" aria-pressed={type === t.key} onClick={() => setType(t.key)}>
                      <span aria-hidden>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lp-wrap dx-section" id="guides" aria-labelledby="dx-guides">
          <div className="dx-section-head">
            <h2 id="dx-guides">{country ? `Guides to ${countries.find((c) => c.code === country)?.name}` : "All destination guides"}</h2>
            <p className="muted small">
              {month !== null && shown.length > 0 && `${good} of ${shown.length} ${good === 1 && shown.length === 1 ? "is" : "are"} good in ${MONTH_NAMES[month]}`}
              {filtered && (
                <>
                  {month !== null && shown.length > 0 && " · "}
                  <button type="button" className="dx-clear" onClick={clear}>
                    Show all guides
                  </button>
                </>
              )}
            </p>
          </div>

          {DESTINATIONS.length === 0 ? (
            <p className="muted">Guides are on their way.</p>
          ) : cards.length === 0 ? (
            <p className="muted">No guides match that yet.</p>
          ) : (
            <div className="dx-grid">
              {cards.map((d) => {
                const months = best.get(d.slug)!;
                const hours = flightHoursTo(from, d);
                const t = d.holiday_types.map(holidayType).find((x) => !!x);
                const idea = onList(d);
                return (
                  <article key={d.slug} className="dx-card">
                    <div className="dx-card-photo">
                      {d.image ? <img src={imageUrl(d.image)} alt={d.image_alt} loading="lazy" /> : <span aria-hidden>{d.to_code || d.name.slice(0, 3).toUpperCase()}</span>}
                      {inSeason(d) && month !== null && <span className="dx-badge">Good in {shortMonth(month)}</span>}
                    </div>
                    <div className="dx-card-body">
                      <Label>{`${countryFlag(d.country_code)} ${d.country.toUpperCase()}`.trim()}</Label>
                      <h3>
                        <a href={destinationPath(d.slug)}>{d.name}</a>
                      </h3>
                      {d.intro && <p className="muted small">{shortIntro(d)}</p>}
                      <div className="dx-pills">
                        {t && (
                          <span>
                            <span aria-hidden>{t.icon}</span> {t.label}
                          </span>
                        )}
                        {hours !== null && <span>✈️ {hours}h</span>}
                        {d.nights && <span>{d.nights} nights</span>}
                        {d.budget && <span>{budgetLabel(d.budget)}</span>}
                      </div>
                    </div>
                    <div className="dx-perf" aria-hidden />
                    <div className="dx-card-foot">
                      <div>
                        <p className="dx-best">
                          <span>BEST TIME</span>
                          <span>{bestMonths(d).toUpperCase() || "ANY TIME"}</span>
                        </p>
                        <div className="dx-months" aria-hidden>
                          {MONTH_NAMES.map((name, i) => (
                            <span key={name} className={`${months.has(i) ? "on" : ""} ${month === i ? "now" : ""}`}>
                              {name[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="dx-card-actions">
                        <a href={destinationPath(d.slug)}>Read the guide</a>
                        {idea ? (
                          <a className="dx-standby" href={`/#/next/${idea.id}`}>
                            On your list
                          </a>
                        ) : (
                          <a className="dx-standby" href={signedIn ? `/#/next/add/${d.slug}` : "/#signin"}>
                            Put on standby
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {countries.length > 0 && (
          <section className="lp-wrap dx-section" aria-labelledby="dx-countries">
            <h2 id="dx-countries">Browse by country</h2>
            <div className="dx-countries">
              {countries.map((c) => (
                <a
                  key={c.code}
                  href={`/destinations?country=${c.code}#guides`}
                  aria-current={country === c.code ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    pickCountry(c.code);
                    document.getElementById("guides")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <span aria-hidden>{countryFlag(c.code)}</span>
                  <span>{c.name}</span>
                  <span className="dx-count">
                    {c.count} {c.count === 1 ? "GUIDE" : "GUIDES"}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {!signedIn && (
          <section className="lp-wrap dx-section">
            <div className="dx-cta">
              <div>
                <span className="dx-cta-label">🎟️ IDEAS ON STANDBY</span>
                <h2>Found somewhere you like?</h2>
                <p className="muted">Put it on standby with the rest of your family's ideas. Everyone spreads their points in secret, gets one veto, and the draw picks where you go.</p>
              </div>
              <div className="dx-cta-actions">
                <a className="btn dg-btn" href="/#signin">
                  Start planning
                </a>
                <a href="/#how">How the draw works</a>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      {signedIn && <AppBottomNav current="guides" />}
    </div>
  );
}
