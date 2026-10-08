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
import { Onboarding } from "./views/Onboarding";
import { PersonPicker } from "./components/PersonPicker";
import { AppBottomNav, AppTopbar } from "./components/AppNav";
import type { TabId } from "./components/AppNav";
import { NotFound } from "./views/Welcome";
import { PAGES, isPrivatePath, publicPage } from "../shared/seo";
import { destinationMeta, findDestination } from "./destinations";
import { DestinationPage, DestinationsIndex } from "./views/DestinationPage";
import type { Family } from "./views/DestinationPage";
import { followInPlace, isGuidePath } from "./navigate";
import { load, save } from "./storage";

/**
 * Reads routes like #/next or #/next/12, and #/next/add/new-york from a destination guide's "Add to ideas".
 * #/welcome replays the welcome steps from Settings.
 */
function currentRoute(): { tab: TabId; id: number | null; add: string | null; welcome: boolean } {
  const [first, second, third] = location.hash.replace(/^#\/?/, "").split("/");
  const tab = (["been", "places", "next", "draw", "settings"] as const).find((t) => t === first) ?? "been";
  const id = Number(second);
  const add = second === "add" && third && findDestination(third) ? third : null;
  return { tab, id: Number.isInteger(id) && id > 0 ? id : null, add, welcome: first === "welcome" };
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

/** A Guides page: the list of guides, one guide, or not found. */
function GuideView({ path, family }: { path: string; family?: Family }) {
  const page = publicPage(path);
  if (page === "destinations") return <DestinationsIndex family={family} />;
  const destination = page?.startsWith("destination:") ? findDestination(page.slice("destination:".length)) : undefined;
  return destination ? <DestinationPage destination={destination} family={family} /> : <NotFound />;
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
    <DataProvider isOwner={session.role === "owner"} shareToken={session.share_token} personId={session.person_id}>
      <Shell path={path} />
    </DataProvider>
  );
}

function Shell({ path }: { path: string }) {
  const { me, ideas, home, loading, error, reload } = useData();
  const [route, setRoute] = useState(currentRoute);
  // Someone new sees the welcome steps once; the server remembers when they've been through them.
  const [welcomed, setWelcomed] = useState(false);
  const tab = route.tab;

  useEffect(() => {
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    // Coming back from the Guides moves the address in place, which doesn't count as a hash change.
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  const go = (t: TabId) => {
    location.hash = `/${t}`;
  };

  if (isGuidePath(path)) {
    return (
      <>
        <GuideView path={path} family={{ signedIn: true, me, ideas: loading ? null : ideas, airport: home }} />
        {!loading && !error && !me && <PersonPicker />}
      </>
    );
  }

  if (!loading && !error && me && (route.welcome || (!me.onboarded && !welcomed))) {
    return (
      <Onboarding
        replay={route.welcome}
        onClose={() => {
          setWelcomed(true);
          // Leaving a replay without picking somewhere to go lands back in Settings.
          if (location.hash === "#/welcome") location.hash = "/settings";
        }}
      />
    );
  }

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
