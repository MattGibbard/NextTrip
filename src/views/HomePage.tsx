import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import { HOME } from "../site";
import { turnstileToken, warmTurnstile } from "../turnstile";
import { FeaturedCreators, SiteFooter, SiteHeader } from "../components/SiteFrame";

/** Text from the editor, where **two stars** around words make them bold. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

/** The public front page, with the sign-in form. */
export function HomePage() {
  const { hero, how, features, why, signup } = HOME;
  return (
    <div className="lp lp-home">
      <SiteHeader sections />

      <section className="lp-wrap lp-hero">
        <div className="lp-hero-text">
          {hero.kicker && <div className="lp-kicker">{hero.kicker}</div>}
          <h1>{hero.heading}</h1>
          {hero.lead && <p className="lp-lead">{hero.lead}</p>}
          <SignInForm id="hero-email" />
          {hero.perks.length > 0 && (
            <div className="lp-perks">
              {hero.perks.map((p) => (
                <span key={p}>
                  <Rich text={p} />
                </span>
              ))}
            </div>
          )}
        </div>
        <HeroTickets />
      </section>

      <section id="how" className="lp-wrap lp-section-how">
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

      <section id="features" className="lp-wrap lp-section">
        <div className="lp-heading">
          {features.kicker && <span className="lp-kicker">{features.kicker}</span>}
          <h2>{features.heading}</h2>
          {features.lead && <p className="lp-lead">{features.lead}</p>}
        </div>
        <div className="lp-features">
          <div className="panel lp-feature">
            <span className="lp-feature-icon" aria-hidden>
              🧳
            </span>
            <h3>{features.been.title}</h3>
            <p className="muted">{features.been.text}</p>
            <div className="lp-feature-foot lp-modes">
              <span className="flight">Flight</span>
              <span className="train">Train</span>
              <span className="cruise">Cruise</span>
              <span className="road">Road</span>
            </div>
          </div>
          <div className="panel lp-feature">
            <span className="lp-feature-icon" aria-hidden>
              🗺️
            </span>
            <h3>{features.places.title}</h3>
            <p className="muted">{features.places.text}</p>
            <div className="lp-feature-foot lp-stamps" aria-hidden>
              <span className="flight round">ESP</span>
              <span className="train square">ITA</span>
              <span className="cruise round">FRA</span>
            </div>
          </div>
          <div className="panel lp-feature">
            <span className="lp-feature-icon" aria-hidden>
              💡
            </span>
            <h3>{features.next.title}</h3>
            <p className="muted">{features.next.text}</p>
            <div className="lp-feature-foot lp-chips">
              <span>🏙️ City break</span>
              <span>🏖️ Beach</span>
              <span>🥾 Nature &amp; hiking</span>
            </div>
          </div>
          <div className="panel lp-feature">
            <span className="lp-feature-icon" aria-hidden>
              🎟️
            </span>
            <h3>{features.draw.title}</h3>
            <p className="muted">{features.draw.text}</p>
            <div className="lp-feature-foot lp-points" aria-hidden>
              <div>
                <strong>23</strong>
                <span>points left</span>
              </div>
              <span className="lp-veto">1 veto</span>
            </div>
          </div>
          <div className="panel lp-feature">
            <span className="lp-feature-icon" aria-hidden>
              🧾
            </span>
            <h3>{features.plan.title}</h3>
            <p className="muted">{features.plan.text}</p>
            <div className="lp-feature-foot lp-plan" aria-hidden>
              <span className="lp-plan-label">Departs in</span>
              <div className="lp-plan-count">
                <span className="lp-flaps">
                  <span>3</span>
                  <span>0</span>
                  <span>7</span>
                </span>
                <span className="lp-plan-label">days</span>
              </div>
              <div className="lp-plan-bar">
                <span />
              </div>
              <div className="lp-plan-money">
                <strong>£2,800</strong> of £6,000 budget
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="lp-why">
        <div className="lp-wrap lp-section">
          <div className="lp-heading">
            {why.kicker && <span className="lp-kicker">{why.kicker}</span>}
            <h2>{why.heading}</h2>
          </div>
          <div className="lp-reasons">
            {why.reasons.map((r) => (
              <div key={r.title} className="lp-reason">
                <h3>{r.title}</h3>
                <p className="muted">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FeaturedCreators />

      <section id="signin" className="lp-wrap lp-section">
        <div className="lp-cta">
          {signup.strip && <div className="lp-cta-strip">{signup.strip}</div>}
          <div className="lp-cta-body">
            <div className="lp-cta-text">
              <h2>{signup.heading}</h2>
              {signup.lead && <p className="lp-lead">{signup.lead}</p>}
            </div>
            <SignInForm id="cta-email" />
          </div>
        </div>
      </section>

      <SiteFooter sections />
    </div>
  );
}

/** The boarding pass and tickets beside the headline. Decoration, so screen readers skip it. */
function HeroTickets() {
  return (
    <div className="lp-tickets" aria-hidden>
      <div className="lp-pass">
        <div className="lp-pass-head">
          <span>Next departure · Boarding pass</span>
          <span className="lp-pass-tag">Ticket 7 / 23</span>
        </div>
        <div className="lp-pass-body">
          <div className="lp-pass-route">
            <div>
              <span className="lp-code">LHR</span>
              <span className="muted small">London</span>
            </div>
            <div className="lp-pass-line">
              <i />
              <span>✈️</span>
              <i />
            </div>
            <div className="end">
              <span className="lp-code">KIX</span>
              <span className="muted small">Osaka</span>
            </div>
          </div>
          <div className="lp-pass-title">🇯🇵 Cherry blossom in Kyoto</div>
          <div className="lp-pass-facts">
            <div>
              <span>Nights away</span>
              <strong>10</strong>
            </div>
            <div>
              <span>Passengers</span>
              <strong>4</strong>
            </div>
            <div>
              <span>Points</span>
              <strong>🏆 38</strong>
            </div>
          </div>
        </div>
        <div className="lp-pass-tear" />
        <div className="lp-pass-foot">
          <span>Picked by the draw, 4 votes in</span>
          <span className="lp-pass-win">🎟️ Winner</span>
        </div>
      </div>
      <div className="lp-mini">
        <div className="lp-stub-ticket">
          <div className="lp-stub">
            <span>Train</span>
          </div>
          <div className="lp-mini-body">
            <span className="lp-mini-label train">Arrived · 2025</span>
            <strong>🇮🇹 Rome and Naples</strong>
            <span className="muted small">7 nights · ★★★★★</span>
          </div>
        </div>
        <div className="lp-standby">
          <span className="lp-mini-label standby">On standby</span>
          <strong>🇳🇴 Northern lights</strong>
          <span className="muted small">🥾 Nature &amp; hiking · £££</span>
        </div>
      </div>
    </div>
  );
}

function SignInForm({ id }: { id: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const botBox = useRef<HTMLDivElement>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await api.sendSignInEmail(email, await turnstileToken(botBox.current!));
      setDevLink(res.dev_link ?? null);
      setDevCode(res.dev_code ?? null);
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className="panel lp-sent" role="status">
        <p className="big">📬 Check your inbox</p>
        <p>
          We've sent a sign-in link and code to <strong>{email.trim()}</strong>. They work once, for the next 20 minutes. If it isn't there, look in your junk folder.
        </p>
        {devLink && (
          <p className="small">
            Local development: <a href={devLink}>open the sign-in link</a>
            {devCode && <> or use code {devCode}</>}
          </p>
        )}
        <CodeForm id={`${id}-code`} email={email} />
        <button className="link" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form className="lp-form" onSubmit={send}>
      <label htmlFor={id}>Your email</label>
      <div className="lp-form-row">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={warmTurnstile}
        />
        <button className="btn" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Create your trips"}
        </button>
      </div>
      <div ref={botBox} className="lp-bot-check" />
      {error && <p className="error-text">{error}</p>}
      <p className="muted small">
        Already signed up? This emails you a sign-in link. By continuing you agree to our <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
}

/**
 * The 6-digit code from the email. Email apps often open links in their own
 * browser, which would sign that in instead of this one, so typing the code
 * here signs in the browser you started in.
 */
function CodeForm({ id, email }: { id: string; email: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.signInWithCode(email, code);
      location.replace("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="lp-form lp-code-form" onSubmit={submit}>
      <label htmlFor={id}>Or enter the code from the email</label>
      <div className="lp-form-row">
        <input
          id={id}
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={7}
          placeholder="123 456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" disabled={busy}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
