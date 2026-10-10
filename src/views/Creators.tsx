import { CREATORS } from "../site";
import { FeaturedCreators, INSTAGRAM, InstagramIcon, SiteFooter, SiteHeader } from "./Welcome";

/**
 * The page at /creators for social media creators: why and how to work with us, and the terms for
 * being featured. Not in the header, only the footer and the sitemap. Its words are edited at /admin.
 */
export function CreatorsPage() {
  const { hero, look_for, how, cta, terms } = CREATORS;
  return (
    <div className="lp lp-home">
      <SiteHeader />

      <section className="lp-wrap lp-hero">
        <div className="lp-hero-text">
          {hero.kicker && <div className="lp-kicker">{hero.kicker}</div>}
          <h1>{hero.heading}</h1>
          {hero.lead && <p className="lp-lead">{hero.lead}</p>}
          <InstagramButton label={hero.button} />
        </div>
        <CreatorPass />
      </section>

      {look_for.reasons.length > 0 && (
        <section className="lp-why">
          <div className="lp-wrap lp-section">
            <div className="lp-heading">
              {look_for.kicker && <span className="lp-kicker">{look_for.kicker}</span>}
              {look_for.heading && <h2>{look_for.heading}</h2>}
            </div>
            <div className="lp-reasons">
              {look_for.reasons.map((r) => (
                <div key={r.title} className="lp-reason">
                  <h3>{r.title}</h3>
                  <p className="muted">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {how.steps.length > 0 && (
        <section className="lp-wrap lp-section-how lp-creators-how">
          <div className="lp-board">
            <div className="lp-board-head">
              {how.label && <span className="lp-board-label">{how.label}</span>}
              <h2>{how.heading}</h2>
            </div>
            <div className="lp-board-rows" role="list">
              <div className="lp-board-row lp-board-cols" aria-hidden>
                <span>Step</span>
                <span>What happens</span>
                <span>Status</span>
              </div>
              {how.steps.map((s, i) => (
                <div key={s.title} className="lp-board-row" role="listitem">
                  <span className="lp-board-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="lp-board-what">
                    <strong>{s.title}</strong>
                    <span>{s.text}</span>
                  </div>
                  <span className={i === how.steps.length - 1 ? "lp-board-status lit" : "lp-board-status"}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <FeaturedCreators more={false} />

      <section className="lp-wrap lp-section">
        <div className="lp-cta">
          {cta.strip && <div className="lp-cta-strip">{cta.strip}</div>}
          <div className="lp-cta-body">
            <div className="lp-cta-text">
              <h2>{cta.heading}</h2>
              {cta.lead && <p className="lp-lead">{cta.lead}</p>}
            </div>
            <div className="lp-creators-cta">
              <InstagramButton label={cta.button} />
            </div>
          </div>
        </div>
      </section>

      {terms.items.length > 0 && (
        <section id="terms" className="lp-wrap lp-section lp-creators-terms">
          <div className="lp-heading">
            {terms.heading && <h2>{terms.heading}</h2>}
            {terms.lead && (
              <p className="muted">
                {terms.lead} {terms.updated && <>Last updated {terms.updated}.</>}
              </p>
            )}
          </div>
          <div className="lp-accordion">
            {terms.items.map((t) => (
              <details key={t.title}>
                <summary>
                  {t.title}
                  <span aria-hidden>+</span>
                </summary>
                {t.text.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </details>
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}

function InstagramButton({ label }: { label: string }) {
  return (
    <div className="lp-creators-ig">
      <a className="btn lp-creators-btn" href={INSTAGRAM} target="_blank" rel="noopener me">
        <InstagramIcon /> {label}
      </a>
      <span className="muted small">@somewhereparty</span>
    </div>
  );
}

/** A boarding pass for creators beside the headline. Decoration, so screen readers skip it. */
function CreatorPass() {
  return (
    <div className="lp-tickets" aria-hidden>
      <div className="lp-pass">
        <div className="lp-pass-head">
          <span>Creator pass · Admit one</span>
          <span className="lp-pass-tag">@somewhereparty</span>
        </div>
        <div className="lp-pass-body">
          <div className="lp-pass-route">
            <div>
              <span className="lp-code">YOU</span>
              <span className="muted small">Your feed</span>
            </div>
            <div className="lp-pass-line">
              <i />
              <span>✈️</span>
              <i />
            </div>
            <div className="end">
              <span className="lp-code">HOM</span>
              <span className="muted small">Our home page</span>
            </div>
          </div>
          <div className="lp-pass-title">🎉 Featured creator</div>
          <div className="lp-pass-facts">
            <div>
              <span>Class</span>
              <strong>Fun</strong>
            </div>
            <div>
              <span>Followers</span>
              <strong>Any</strong>
            </div>
            <div>
              <span>Fare</span>
              <strong>Free</strong>
            </div>
          </div>
        </div>
        <div className="lp-pass-tear" />
        <div className="lp-pass-foot">
          <span>Check in with a DM on Instagram</span>
          <span className="lp-pass-win">🎟️ Boarding</span>
        </div>
      </div>
    </div>
  );
}
