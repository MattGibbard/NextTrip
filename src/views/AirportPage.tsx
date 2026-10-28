// The airport guides: /airports lists them, and each UK or Irish airport has its own page with its
// terminals, getting there, the blog posts about it and a departures board of where you can fly.
import { useEffect } from "react";
import { PAGES, airportPath, postPath } from "../../shared/seo";
import { airportFrom, mainAirport } from "../../shared/mainAirports";
import { AIRPORTS, airportSearchTitle } from "../airportPages";
import type { Airport } from "../airportPages";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { AirportBoard } from "../components/PostBoxes";
import { RichText, anchor } from "./InfoPage";

/** How many places an airport's departures board shows. */
const BOARD_ROWS = 10;

/** The general plane-side post, which every airport page points to. */
const PLANE_SIDE = { slug: "which-side-of-the-plane-to-sit-on", title: "Which side of the plane to sit on" };

export function AirportPage({ airport: a }: { airport: Airport }) {
  useEffect(() => {
    document.title = airportSearchTitle(a);
  }, [a]);
  const main = mainAirport(a.code);
  const others = AIRPORTS.filter((x) => x.slug !== a.slug);
  const posts = [...a.posts, ...(a.posts.some((p) => p.slug === PLANE_SIDE.slug) ? [] : [{ ...PLANE_SIDE, intro: "" }])];

  return (
    <div className="lp lp-home lp-info bl ap">
      <SiteHeader />

      <main>
        <header className="lp-wrap lp-info-head">
          <nav aria-label="Breadcrumb" className="bl-crumbs">
            <a href="/">Home</a>
            <span aria-hidden>›</span>
            <a href="/airports">Airports</a>
          </nav>
          <p className="ap-code" aria-hidden>
            <span>{a.code}</span> AIRPORT GUIDE
          </p>
          <h1>{a.title}</h1>
          {a.intro && <p className="lp-lead">{a.intro}</p>}
        </header>

        <div className="lp-wrap lp-info-body bl-body">
          <div className="bl-main">
            {a.terminals.length > 0 && (
              <section className="ap-terminals" aria-labelledby="ap-terminals">
                <h2 id="ap-terminals">{a.terminals.length === 1 ? "The terminal" : `${a.terminals.length} terminals: which airline goes where`}</h2>
                <div className={`ap-terminal-list ${a.terminals.length === 1 ? "one" : ""}`}>
                  {a.terminals.map((t) => (
                    <article key={t.name} className="ap-terminal">
                      <h3>{t.name}</h3>
                      {t.airlines && (
                        <p className="ap-airlines">
                          <span>AIRLINES</span>
                          {t.airlines}
                        </p>
                      )}
                      {t.text && <RichText text={t.text} />}
                    </article>
                  ))}
                </div>
                <p className="muted small">Airlines sometimes change terminals, so check your booking or the airport's website before you go.</p>
              </section>
            )}

            <section className="ap-posts" aria-labelledby="ap-posts">
              <h2 id="ap-posts">Before you fly</h2>
              <ul>
                {posts.map((p) => (
                  <li key={p.slug}>
                    <a href={postPath(p.slug)}>{p.title}</a>
                    {p.intro && <span className="muted small">{p.intro}</span>}
                  </li>
                ))}
              </ul>
            </section>

            {a.sections.length > 0 && (
              <article className="lp-article">
                {a.sections.map((s, i) => (
                  <section key={i} id={s.heading ? anchor(s.heading) : undefined}>
                    {s.heading && <h2>{s.heading}</h2>}
                    <RichText text={s.text} />
                  </section>
                ))}
              </article>
            )}

            {main && a.places.length > 0 && <AirportBoard places={a.places} airport={airportFrom(main)} place="airport_guide" rows={BOARD_ROWS} />}
          </div>
        </div>

        {a.faqs.length > 0 && (
          <section className="lp-wrap lp-info-faqs" aria-labelledby="ap-faq">
            <div className="lp-info-faqs-inner">
              <h2 id="ap-faq">{a.name}: common questions</h2>
              <div className="lp-accordion">
                {a.faqs.map((q) => (
                  <details key={q.question}>
                    <summary>
                      {q.question}
                      <span aria-hidden>+</span>
                    </summary>
                    <RichText text={q.answer} />
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {others.length > 0 && (
          <nav className="lp-wrap ap-others" aria-labelledby="ap-others">
            <h2 id="ap-others">Other airport guides</h2>
            <AirportList airports={others} />
          </nav>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

/** /airports: every airport guide. */
export function AirportsIndex() {
  useEffect(() => {
    document.title = PAGES.airports.title;
  }, []);
  return (
    <div className="lp lp-home lp-info bl ap">
      <SiteHeader />
      <main>
        <header className="lp-wrap lp-info-head">
          <nav aria-label="Breadcrumb" className="bl-crumbs">
            <a href="/">Home</a>
          </nav>
          <h1>UK and Irish airport guides</h1>
          <p className="lp-lead">Which airline flies from which terminal, how to get to the airport, how early to arrive and where you can fly direct, for {AIRPORTS.length} airports.</p>
        </header>
        <div className="lp-wrap ap-index">
          <AirportList airports={AIRPORTS} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function AirportList({ airports }: { airports: Airport[] }) {
  return (
    <ul className="ap-list">
      {airports.map((x) => (
        <li key={x.slug}>
          <a href={airportPath(x.slug)}>
            <span className="ap-list-code">{x.code}</span>
            <span className="ap-list-name">{x.name}</span>
            <span className="ap-list-meta">{x.terminals.length === 1 ? "1 terminal" : `${x.terminals.length} terminals`}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
