import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { api } from "../api";
import { DESTINATIONS } from "../destinations";
import { destinationPath } from "../../shared/seo";
import { HOME } from "../site";

/** The page frame for signed-out pages other than the home page: the home page's header and footer around the content. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="lp">
      <SiteHeader />
      <main className="lp-wrap lp-frame">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** The signed-out header, shared by the home page and the other public pages. Destination guides get their own links. */
export function SiteHeader({ sections = false, guide = false }: { sections?: boolean; guide?: boolean | "index" }) {
  if (guide) {
    return (
      <header className="lp-top">
        <div className="lp-wrap lp-top-inner">
          <a className="lp-brand" href="/">
            somewhere<span aria-hidden>🎉</span>
          </a>
          <nav className="lp-nav lp-nav-guide" aria-label="Main">
            <a className="lp-nav-keep" href="/destinations" aria-current={guide === "index" ? "page" : undefined}>
              Guides
            </a>
            <a href="/#how">How the draw works</a>
            <a href="/#signin">Sign in</a>
          </nav>
          <a className="btn lp-top-signin lp-top-start" href="/#signin">
            Start planning
          </a>
        </div>
      </header>
    );
  }
  return (
    <header className="lp-top">
      <div className="lp-wrap lp-top-inner">
        <a className="lp-brand" href="/">
          somewhere<span aria-hidden>🎉</span>
        </a>
        <nav className="lp-nav" aria-label="Main">
          {sections && (
            <>
              <a href="#how" onClick={jump}>
                How it works
              </a>
              <a href="#features" onClick={jump}>
                Features
              </a>
              <a href="#why" onClick={jump}>
                Why use it
              </a>
            </>
          )}
          <a className="lp-nav-keep" href="/destinations">
            Guides
          </a>
        </nav>
        {sections ? (
          <a className="btn ghost lp-top-signin" href="#signin" onClick={jump}>
            Sign in
          </a>
        ) : (
          <a className="btn ghost lp-top-signin" href="/">
            Home
          </a>
        )}
      </div>
    </header>
  );
}

export function SiteFooter({ sections = false }: { sections?: boolean }) {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap lp-foot-inner">
        <div>
          <div className="lp-brand">
            somewhere<span aria-hidden>🎉</span>
          </div>
          <div className="muted small">Where we've been, and where we're going next.</div>
        </div>
        {DESTINATIONS.length > 0 && (
          <nav aria-label="Guides" className="lp-foot-dest">
            <span className="lp-foot-label">GUIDES</span>
            <div className="lp-foot-dest-links">
              {DESTINATIONS.slice(0, 11).map((d) => (
                <a key={d.slug} href={destinationPath(d.slug)}>
                  {d.name}
                </a>
              ))}
              <a href="/destinations">All guides</a>
            </div>
          </nav>
        )}
        <nav aria-label="Footer" className="lp-foot-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          {sections && (
            <a href="#signin" onClick={jump}>
              Sign in
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}

export function LegalLinks() {
  return (
    <footer className="legal-links muted small">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </footer>
  );
}

/** Scrolls to a section of the home page without touching the hash, which the signed-in app uses for its tabs. */
function jump(e: MouseEvent<HTMLAnchorElement>) {
  const id = e.currentTarget.getAttribute("href")?.slice(1);
  const el = id && document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

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

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await api.sendSignInEmail(email);
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
        />
        <button className="btn" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Create your trips"}
        </button>
      </div>
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

/**
 * Where the emailed link lands. It signs in straight away and opens the app.
 * The token is only used up by the POST this page's script sends, so an email
 * app or scanner that just fetches the link ahead of you doesn't spend it. A
 * page opened in the background waits until it's actually on screen.
 */
export function SignInPage({ token, onSignedIn }: { token: string; onSignedIn: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    const go = () => {
      if (started.current || document.visibilityState !== "visible") return;
      started.current = true;
      document.removeEventListener("visibilitychange", go);
      api.verifySignIn(token).then(onSignedIn, (e: Error) => setError(e.message));
    };
    go();
    document.addEventListener("visibilitychange", go);
    return () => document.removeEventListener("visibilitychange", go);
  }, [token, onSignedIn]);
  return (
    <Frame>
      <section className="intro narrow">
        <div className="panel signin">
          {error ? (
            <>
              <p className="big">That link didn't work</p>
              <p className="error-text">{error}</p>
              <a className="btn large" href="/">
                Get a new link
              </a>
            </>
          ) : (
            <p className="big">Signing you in…</p>
          )}
        </div>
      </section>
    </Frame>
  );
}

/** Any address that isn't a page. The server sends it with a 404 so search engines drop it. */
export function NotFound() {
  return (
    <Frame>
      <section className="intro narrow">
        <div className="panel signin">
          <h1 className="big">Page not found</h1>
          <p className="muted">There's nothing at this address. If someone sent you a family link, check it was copied in full.</p>
          <a className="btn large" href="/">
            Go to the home page
          </a>
        </div>
      </section>
    </Frame>
  );
}

/** Where a family link lands: joins the family on this browser, then opens the app. */
export function JoinPage({ token, onJoined }: { token: string; onJoined: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.join(token).then(onJoined, (e: Error) => setError(e.message));
  }, [token, onJoined]);
  return (
    <Frame>
      <section className="intro narrow">
        <div className="panel signin">
          {error ? (
            <>
              <p className="big">That link didn't work</p>
              <p className="error-text">{error}</p>
              <a className="btn ghost" href="/">
                Go to the somewhere🎉 home page
              </a>
            </>
          ) : (
            <p className="big">Opening your family's somewhere🎉…</p>
          )}
        </div>
      </section>
    </Frame>
  );
}

/** A link the organiser made for one person, to sign them in on a new device. */
export function PersonLinkPage({ token, onJoined }: { token: string; onJoined: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.usePersonLink(token).then(onJoined, (e: Error) => setError(e.message));
  }, [token, onJoined]);
  return (
    <Frame>
      <section className="intro narrow">
        <div className="panel signin">
          {error ? (
            <>
              <p className="big">That link didn't work</p>
              <p className="error-text">{error}</p>
              <a className="btn ghost" href="/">
                Go to the somewhere🎉 home page
              </a>
            </>
          ) : (
            <p className="big">Signing you in…</p>
          )}
        </div>
      </section>
    </Frame>
  );
}
