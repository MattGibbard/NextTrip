import { useEffect, useState } from "react";
import type { Idea } from "../../shared/types";
import { api } from "../api";
import { DESTINATIONS, destinationNamed, imageUrl } from "../destinations";
import type { Destination } from "../destinations";
import { budgetLabel, holidayType, travelTimeLabel } from "../../shared/ideaDetails";
import { destinationPath } from "../../shared/seo";
import { SiteFooter, SiteHeader } from "./Welcome";

/**
 * Who's looking. Starts as a visitor, the same as the prerendered page, then checks for a signed-in
 * family once the page is up so it can offer "Add to ideas" and show their ideas alongside.
 */
function useFamily(): { signedIn: boolean; ideas: Idea[] | null } {
  const [state, setState] = useState<{ signedIn: boolean; ideas: Idea[] | null }>({ signedIn: false, ideas: null });
  useEffect(() => {
    let live = true;
    void api
      .session()
      .then(async (s) => {
        if (!s.signed_in || !live) return;
        setState({ signedIn: true, ideas: null });
        const ideas = await api.ideas();
        if (live) setState({ signedIn: true, ideas });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return state;
}

const APP_TABS = [
  { id: "been", label: "Been", icon: "🧳" },
  { id: "places", label: "Places", icon: "🗺️" },
  { id: "next", label: "Next", icon: "💡" },
  { id: "draw", label: "Draw", icon: "🎟️" },
];

/** The signed-in app's header, as links back into the app. */
function AppHeader() {
  return (
    <header className="lp-top">
      <div className="lp-wrap lp-top-inner">
        <a className="lp-brand" href="/#/been">
          somewhere<span aria-hidden>🎉</span>
        </a>
        <nav className="dg-apptabs" aria-label="Main">
          {APP_TABS.map((t) => (
            <a key={t.id} href={`/#/${t.id}`} aria-current={t.id === "next" ? "page" : undefined}>
              <span aria-hidden>{t.icon}</span> {t.label}
            </a>
          ))}
        </nav>
        <a className="icon-btn" href="/#/settings" aria-label="Settings">
          ⚙️
        </a>
      </div>
    </header>
  );
}

function Label({ children }: { children: string }) {
  return <span className="dg-label">{children}</span>;
}

/** A destination guide, for visitors finding it in search and for signed-in families looking for ideas. */
export function DestinationPage({ destination: d }: { destination: Destination }) {
  const { signedIn, ideas } = useFamily();
  const onList = ideas?.find((i) => i.status === "active" && i.title.trim().toLowerCase() === d.name.toLowerCase());
  const standby = ideas?.filter((i) => i.status === "active" && i !== onList).slice(0, 3) ?? [];
  const types = d.holiday_types.map(holidayType).filter((t) => !!t);

  return (
    <div className="lp dg">
      {signedIn ? <AppHeader /> : <SiteHeader guide />}

      <main className="lp-wrap dg-main">
        <div className="dg-top">
          <nav aria-label="Breadcrumb" className="dg-crumbs">
            {signedIn ? <a href="/#/next">Next</a> : <a href="/">Home</a>}
            <span aria-hidden>›</span>
            <a href="/destinations">Destinations</a>
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
                {d.from_code && d.to_code && (
                  <div className="dg-route">
                    <div>
                      <Label>FROM</Label>
                      <span className="dg-code">{d.from_code}</span>
                    </div>
                    <div className="dg-route-line">{d.flight_time && <span>{d.flight_time.toUpperCase()} ✈️</span>}</div>
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
                {d.best_months && (
                  <div>
                    <Label>BEST MONTHS</Label>
                    <strong>{d.best_months}</strong>
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
              <img className="dg-photo" src={imageUrl(d.image)} alt={d.image_alt} />
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
                    <td>{d.flight_time ? `✈️ ${d.flight_time}` : ""}</td>
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

        {d.facts.length > 0 && (
          <section aria-labelledby="dg-facts" className="dg-section">
            <h2 id="dg-facts">{d.name} at a glance</h2>
            <dl className="dg-board">
              {d.facts.map((f) => (
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
            <h2 id="dg-faq">{d.name} with kids: common questions</h2>
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
    </div>
  );
}

/** Every guide, for browsing. */
export function DestinationsIndex() {
  return (
    <div className="lp dg">
      <SiteHeader guide />
      <main className="lp-wrap dg-main">
        <div className="dg-index-head">
          <span className="dg-label">DESTINATIONS</span>
          <h1>Family holiday ideas</h1>
          <p className="dg-intro">When to go, how long to stay and what to do with the kids. Find somewhere new and put it on standby for your next draw.</p>
        </div>
        {DESTINATIONS.length === 0 ? (
          <p className="muted">Guides are on their way.</p>
        ) : (
          <div className="dg-similar dg-index">
            {DESTINATIONS.map((d) => (
              <a key={d.slug} className="dg-similar-card" href={destinationPath(d.slug)}>
                <span className="dg-similar-code">{d.to_code || d.name.slice(0, 3).toUpperCase()}</span>
                <span>
                  <strong>{d.name}</strong>
                  <span className="muted small">{d.country}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
