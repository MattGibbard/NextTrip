import { useCallback, useEffect, useState } from "react";
import type { Session } from "../shared/types";
import { api, forgetLegacyPerson, setSignedOutHandler } from "./api";
import { DataProvider, useData } from "./data";
import { HomePage, JoinPage, PersonLinkPage, SignInPage } from "./views/Welcome";
import { LegalView, legalPage } from "./views/Legal";
import { TripsView } from "./views/TripsView";
import { PlacesView } from "./views/PlacesView";
import { IdeasView } from "./views/IdeasView";
import { DrawView } from "./views/DrawView";
import { SettingsView } from "./views/SettingsView";
import { IdeaPage } from "./views/IdeaPage";
import { TripPage } from "./views/TripPage";
import { PersonPicker } from "./components/PersonPicker";
import { AppBottomNav, AppTopbar } from "./components/AppNav";
import type { TabId } from "./components/AppNav";
import { NotFound } from "./views/Welcome";
import { isPrivatePath, publicPage } from "../shared/seo";
import { findDestination } from "./destinations";
import { DestinationPage, DestinationsIndex } from "./views/DestinationPage";
import { load, save } from "./storage";

/** Reads routes like #/next or #/next/12, and #/next/add/new-york from a destination guide's "Add to ideas". */
function currentRoute(): { tab: TabId; id: number | null; add: string | null } {
  const [first, second, third] = location.hash.replace(/^#\/?/, "").split("/");
  const tab = (["been", "places", "next", "draw", "settings"] as const).find((t) => t === first) ?? "been";
  const id = Number(second);
  const add = second === "add" && third && findDestination(third) ? third : null;
  return { tab, id: Number.isInteger(id) && id > 0 ? id : null, add };
}

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
  const path = location.pathname;
  const legal = legalPage(path);
  if (legal) return <LegalView page={legal} />;
  const page = publicPage(path);
  if (page === "destinations") return <DestinationsIndex />;
  if (page?.startsWith("destination:")) {
    const destination = findDestination(page.slice("destination:".length));
    return destination ? <DestinationPage destination={destination} /> : <NotFound />;
  }
  if (path !== "/" && !isPrivatePath(path)) return <NotFound />;
  return <Main />;
}

// Remembers whether this browser was signed in last time, so the home page isn't shown to people who
// are about to land in the app. index.html reads the same key before the first paint.
const SIGNED_IN = "signedIn";

function Main() {
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
  if (!session.signed_in) return <HomePage />;
  return (
    <DataProvider isOwner={session.role === "owner"} shareToken={session.share_token} personId={session.person_id}>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { me, loading, error, reload } = useData();
  const [route, setRoute] = useState(currentRoute);
  const tab = route.tab;

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (t: TabId) => {
    location.hash = `/${t}`;
  };

  return (
    <div className="app">
      <AppTopbar current={tab} me={me} go={go} />

      <main className="content">
        {error && (
          <div className="banner error">
            {error} <button onClick={() => void reload()}>Retry</button>
          </div>
        )}
        {loading ? (
          <p className="muted center">Loading…</p>
        ) : (
          <>
            {tab === "been" && (route.id ? <TripPage key={route.id} id={route.id} /> : <TripsView addFrom={route.add} />)}
            {tab === "places" && <PlacesView />}
            {tab === "next" && (route.id ? <IdeaPage key={route.id} id={route.id} /> : <IdeasView addFrom={route.add} />)}
            {tab === "draw" && <DrawView />}
            {tab === "settings" && <SettingsView />}
          </>
        )}
      </main>

      <AppBottomNav current={tab} go={go} />

      {!loading && !error && !me && <PersonPicker />}
    </div>
  );
}
