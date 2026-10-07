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
import { NotFound } from "./views/Welcome";
import { isPrivatePath } from "../shared/seo";
import { load, save } from "./storage";

const TABS = [
  { id: "trips", label: "Trips", icon: "🧳" },
  { id: "places", label: "Places", icon: "🗺️" },
  { id: "ideas", label: "Ideas", icon: "💡" },
  { id: "draw", label: "Draw", icon: "🎟️" },
] as const;

type TabId = (typeof TABS)[number]["id"] | "settings";

/** Reads routes like #/ideas or #/ideas/12. */
function currentRoute(): { tab: TabId; id: number | null } {
  const [first, second] = location.hash.replace(/^#\/?/, "").split("/");
  const tab = (["trips", "places", "ideas", "draw", "settings"] as const).find((t) => t === first) ?? "trips";
  const id = Number(second);
  return { tab, id: Number.isInteger(id) && id > 0 ? id : null };
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
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/trips">
            somewhere<span aria-hidden>🎉</span>
          </a>
          <nav className="tabs desktop-only" aria-label="Main">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="topbar-right">
            {me && (
              <a className="me-chip" href="#/settings" title="You, on this device">
                <span className="dot" style={{ background: me.color }} />
                {me.name}
              </a>
            )}
            <button className={`icon-btn ${tab === "settings" ? "active" : ""}`} onClick={() => go("settings")} aria-label="Settings">
              ⚙️
            </button>
          </div>
        </div>
      </header>

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
            {tab === "trips" && (route.id ? <TripPage key={route.id} id={route.id} /> : <TripsView />)}
            {tab === "places" && <PlacesView />}
            {tab === "ideas" && (route.id ? <IdeaPage key={route.id} id={route.id} /> : <IdeasView />)}
            {tab === "draw" && <DrawView />}
            {tab === "settings" && <SettingsView />}
          </>
        )}
      </main>

      <nav className="bottom-nav mobile-only">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {!loading && !error && !me && <PersonPicker />}
    </div>
  );
}
