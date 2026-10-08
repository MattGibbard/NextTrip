import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { Session } from "../shared/types";
import { api, forgetLegacyPerson, setSignedOutHandler } from "./api";
import { HomePage, JoinPage, PersonLinkPage, SignInPage } from "./views/Welcome";
import { LegalView, legalPage } from "./views/Legal";
import { NotFound } from "./views/Welcome";
import { PAGES, isPrivatePath, publicPage } from "../shared/seo";
import { destinationMeta, findDestination } from "./destinations";
import { GuideView } from "./views/GuideView";
import { followInPlace, isGuidePath } from "./navigate";
import { load, save } from "./storage";

// The signed-in app (its views, the map and the draw) loads only once someone is signed in, so the
// public pages that visitors and search engines see stay small and quick.
const SignedIn = lazy(() => import("./SignedIn"));

/**
 * A family link (/f/…), a person's own link from the organiser (/p/…) or an
 * emailed sign-in link (/signin?token=…), if that's how we got here.
 */
function entryLink(): { kind: "join" | "person" | "signin"; token: string } | null {
  const join = location.pathname.match(/^\/f\/([\w-]+)\/?$/);
  if (join) return { kind: "join", token: join[1] };
  const person = location.pathname.match(/^\/p\/([\w-]+)\/?$/);
  if (person) return { kind: "person", token: person[1] };
  const token = new URLSearchParams(location.search).get("token");
  if (location.pathname === "/signin" && token) return { kind: "signin", token };
  return null;
}

export function App() {
  const [path, setPath] = useState(() => location.pathname);

  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    // Signed in, links between the app and the Guides pages switch in place. Visitors' pages load as
    // normal, the same as search engines see them.
    const onClick = (e: MouseEvent) => {
      if (load(SIGNED_IN, false)) followInPlace(e);
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    document.title = pageTitle(path);
  }, [path]);

  const legal = legalPage(path);
  if (legal) return <LegalView page={legal} />;
  // Signed-in families see the Guides inside the app, so moving between them is instant.
  // index.html clears the visitors' version before the first paint so it doesn't flash.
  if (isGuidePath(path) && !load(SIGNED_IN, false)) return <GuideView path={path} />;
  if (path !== "/" && !isGuidePath(path) && !isPrivatePath(path)) return <NotFound />;
  return <Main path={path} />;
}

/** The tab title for an address, kept up to date as the app moves between pages in place. */
function pageTitle(path: string): string {
  const page = publicPage(path);
  if (page === "destinations") return PAGES.destinations.title;
  const destination = page?.startsWith("destination:") ? findDestination(page.slice("destination:".length)) : undefined;
  return destination ? destinationMeta(destination).title : "somewhere🎉";
}

// Remembers whether this browser was signed in last time, so the home page isn't shown to people who
// are about to land in the app. index.html reads the same key before the first paint.
const SIGNED_IN = "signedIn";

function Main({ path }: { path: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [entry, setEntry] = useState(entryLink);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      save(SIGNED_IN, s.signed_in);
      setSession(s);
      // The server has carried over any person this browser picked before, so the old choice can go.
      forgetLegacyPerson();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Once a link has done its job, tidy the address bar so it isn't bookmarked or shared by mistake.
  const entered = useCallback(() => {
    history.replaceState(null, "", "/");
    setEntry(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSignedOutHandler(() => {
      save(SIGNED_IN, false);
      setSession({ signed_in: false });
    });
    if (!entry) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (entry?.kind === "join") return <JoinPage token={entry.token} onJoined={entered} />;
  if (entry?.kind === "person") return <PersonLinkPage token={entry.token} onJoined={entered} />;
  if (entry?.kind === "signin") return <SignInPage token={entry.token} onSignedIn={entered} />;
  if (!session) {
    return error ? (
      <div className="banner error">
        {error} <button onClick={() => void refresh()}>Retry</button>
      </div>
    ) : location.pathname === "/" && !load(SIGNED_IN, false) ? (
      // The same page the server sent, so nothing jumps while we check.
      <HomePage />
    ) : (
      <p className="muted center">Loading…</p>
    );
  }
  if (!session.signed_in) return isGuidePath(path) ? <GuideView path={path} /> : <HomePage />;
  return (
    <Suspense fallback={<p className="muted center">Loading…</p>}>
      <SignedIn session={session} path={path} />
    </Suspense>
  );
}
