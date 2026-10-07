import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { api } from "../api";

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

/** The signed-out header, shared by the home page and the other public pages. */
function SiteHeader({ sections = false }: { sections?: boolean }) {
  return (
    <header className="lp-top">
      <div className="lp-wrap lp-top-inner">
        <a className="lp-brand" href="/">
          somewhere<span aria-hidden>🎉</span>
        </a>
        {sections && (
          <nav className="lp-nav" aria-label="Main">
            <a href="#how" onClick={jump}>
              How it works
            </a>
            <a href="#features" onClick={jump}>
              Features
            </a>
            <a href="#why" onClick={jump}>
              Why use it
            </a>
          </nav>
        )}
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

function SiteFooter({ sections = false }: { sections?: boolean }) {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap lp-foot-inner">
        <div>
          <div className="lp-brand">
            somewhere<span aria-hidden>🎉</span>
          </div>
          <div className="muted small">Where we've been, and where we're going next.</div>
        </div>
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

const STEPS = [
  {
    title: "Sign up and add the trips you've been on",
    text: "One of you signs up with an email and shares a link with everyone else. Each holiday becomes a ticket, and your map and passport fill in as you go.",
    status: "Arrived",
  },
  {
    title: "Put your ideas on standby",
    text: "Anyone in the family can add a place they'd love to go, with budget, travel time and type of trip.",
    status: "On standby",
  },
  {
    title: "Everyone spreads their points",
    text: "You each share out your points in secret and get one veto. Nobody sees anyone else's until the draw.",
    status: "Boarding",
  },
  {
    title: "The draw picks where you go",
    text: "The more points an idea has, the bigger its slice of the wheel. Spin it and see which one gets a seat.",
    status: "Now departing",
  },
];

const REASONS = [
  {
    title: "Everyone gets a say",
    text: "Points are spread in secret, so the quietest voice counts as much as the loudest. And if there's somewhere you really can't face, that's what your veto is for.",
  },
  {
    title: "No more going round in circles",
    text: "Ideas stop getting lost in the group chat. They sit on standby until the draw, and once it's spun, the decision's made and you can get on with booking.",
  },
  {
    title: "Remember everywhere you've been",
    text: "Every trip fills in your map and passport, so years of family holidays live in one place, not across old photos and half-remembered dates.",
  },
];

/** The public front page, with the sign-in form. */
export function HomePage() {
  return (
    <div className="lp lp-home">
      <SiteHeader sections />

      <section className="lp-wrap lp-hero">
        <div className="lp-hero-text">
          <div className="lp-kicker">The family holiday planner</div>
          <h1>Can't agree where to go next? Let the draw decide.</h1>
          <p className="lp-lead">
            somewhere🎉 keeps your family's holidays in one place: the trips you've been on, a map of where you've been, and a pool of ideas for where to go next. When it's
            time to choose, everyone spreads their points in secret and the draw picks the winner.
          </p>
          <SignInForm id="hero-email" />
          <div className="lp-perks">
            <span>
              <strong>Free</strong> for the whole family
            </span>
            <span>One email for everyone</span>
            <span>Share a link to invite the others</span>
          </div>
        </div>
        <HeroTickets />
      </section>

      <section id="how" className="lp-wrap lp-section-how">
        <div className="lp-board">
          <div className="lp-board-head">
            <span className="lp-board-label">Departures · How it works</span>
            <h2>From "where shall we go?" to booked, in four steps.</h2>
          </div>
          <div className="lp-board-rows" role="list">
            <div className="lp-board-row lp-board-cols" aria-hidden>
              <span>Step</span>
              <span>What happens</span>
              <span>Status</span>
            </div>
            {STEPS.map((s, i) => (
              <div key={s.title} className="lp-board-row" role="listitem">
                <span className="lp-board-num">{String(i + 1).padStart(2, "0")}</span>
                <div className="lp-board-what">
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </div>
                <span className={i === STEPS.length - 1 ? "lp-board-status lit" : "lp-board-status"}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="lp-wrap lp-section">
        <div className="lp-heading">
          <span className="lp-kicker">What's inside</span>
          <h2>Everything your family's holidays need, in one place</h2>
          <p className="lp-lead">Where you've been, where you want to go, and a fair way to choose between them.</p>
        </div>
        <div className="lp-features">
          <div className="panel lp-feature">
            <span className="lp-feature-icon" aria-hidden>
              🧳
            </span>
            <h3>Trips</h3>
            <p className="muted">Every holiday you've had, as a ticket: where, when, how long, who came and how you got there.</p>
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
            <h3>Places</h3>
            <p className="muted">A map of everywhere you've been and everywhere you want to go, plus a passport that collects a stamp for each country.</p>
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
            <h3>Ideas</h3>
            <p className="muted">A shared pool of places to go next. Add the type of trip, the budget and the travel time so you can compare like for like.</p>
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
            <h3>The draw</h3>
            <p className="muted">Everyone spreads their points in secret, gets one veto, and the wheel picks where you go. Past draws are kept, so you can see how each one went.</p>
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
            <span className="lp-kicker">Why somewhere🎉</span>
            <h2>Picking a holiday shouldn't be the hard part</h2>
          </div>
          <div className="lp-reasons">
            {REASONS.map((r) => (
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
          <div className="lp-cta-strip">Now boarding · All passengers</div>
          <div className="lp-cta-body">
            <div className="lp-cta-text">
              <h2>Your next holiday is somewhere🎉. Find out where.</h2>
              <p className="lp-lead">It's free. One of you signs up with an email, then shares a link so the rest of the family can join. No one else needs an account.</p>
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

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await api.sendSignInEmail(email);
      setDevLink(res.dev_link ?? null);
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
          We've sent a sign-in link to <strong>{email.trim()}</strong>. It works once, for the next 20 minutes. If it isn't there, look in your junk folder.
        </p>
        {devLink && (
          <p className="small">
            Local development: <a href={devLink}>open the sign-in link</a>
          </p>
        )}
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
