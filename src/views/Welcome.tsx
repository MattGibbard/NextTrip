import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api } from "../api";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="welcome">
      <header className="welcome-top">
        <a className="brand" href="/">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          NextTrip
        </a>
      </header>
      {children}
    </div>
  );
}

const FEATURES = [
  { icon: "🧳", title: "Trips", text: "Every holiday you've been on, with dates, places, notes and a rating." },
  { icon: "🗺️", title: "Places", text: "A map of everywhere you've been, and the ideas you haven't got to yet." },
  { icon: "💡", title: "Ideas", text: "Anyone in the family can add an idea, with a budget, trip length and type of holiday." },
  { icon: "🎟️", title: "The draw", text: "Everyone spreads their points in secret, gets one veto, and the draw picks where you go." },
];

/** The public front page, with the sign-in form. */
export function HomePage() {
  return (
    <Frame>
      <section className="intro">
        <h1>Can't agree where to go next? Let the draw decide.</h1>
        <p className="lead">
          NextTrip keeps your family's holidays in one place: the trips you've taken, a map of everywhere you've been, and a pool of ideas for the next one. When it's time
          to choose, everyone spends their points and the draw picks the winner.
        </p>
        <SignInForm />
      </section>

      <section className="feature-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel feature">
            <span className="feature-icon" aria-hidden>
              {f.icon}
            </span>
            <h2>{f.title}</h2>
            <p className="muted">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="panel how">
        <h2>One sign-in for the whole family</h2>
        <p>
          One person signs in with their email address. They get a private family link to send to everyone else, who just open it, type their name and pick a colour. Nobody
          else needs an account or a password.
        </p>
        <h2>Hardly any personal data</h2>
        <p className="muted">
          Your email address is only used to send your sign-in link. We don't keep it, just a one-way fingerprint of it so we recognise you next time. There are no passwords,
          no ads and no tracking.
        </p>
      </section>
    </Frame>
  );
}

function SignInForm() {
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
      <div className="panel signin">
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
    <form className="panel signin" onSubmit={send}>
      <label className="field">
        <span>Sign in or get started with your email</span>
        <input type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="btn large" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="muted small">No password needed. New here? The same link sets up your family.</p>
    </form>
  );
}

/**
 * Where the emailed link lands. It takes a tap to finish, so an email app or
 * scanner that opens the link ahead of you doesn't use it up.
 */
export function SignInPage({ token, onSignedIn }: { token: string; onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.verifySignIn(token);
      onSignedIn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Frame>
      <section className="intro narrow">
        <div className="panel signin">
          <p className="big">Welcome back</p>
          <p className="muted">Tap below to finish signing in on this device.</p>
          {error ? (
            <>
              <p className="error-text">{error}</p>
              <a className="btn large" href="/">
                Get a new link
              </a>
            </>
          ) : (
            <button className="btn large" onClick={go} disabled={busy}>
              {busy ? "Signing in…" : "Sign in to NextTrip"}
            </button>
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
                Go to the NextTrip home page
              </a>
            </>
          ) : (
            <p className="big">Opening your family's NextTrip…</p>
          )}
        </div>
      </section>
    </Frame>
  );
}
