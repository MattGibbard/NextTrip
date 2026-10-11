// Where emailed sign-in links, family links and personal links land.
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Frame } from "../components/SiteFrame";

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
