import { useEffect, useState } from "react";
import { DataProvider, useData } from "./data";
import { TripsView } from "./views/TripsView";
import { PlacesView } from "./views/PlacesView";
import { IdeasView } from "./views/IdeasView";
import { DrawView } from "./views/DrawView";
import { SettingsView } from "./views/SettingsView";
import { PersonPicker } from "./components/PersonPicker";

const TABS = [
  { id: "trips", label: "Trips", icon: "🧳" },
  { id: "places", label: "Places", icon: "🗺️" },
  { id: "ideas", label: "Ideas", icon: "💡" },
  { id: "draw", label: "Draw", icon: "🎟️" },
] as const;

type TabId = (typeof TABS)[number]["id"] | "settings";

function currentTab(): TabId {
  const h = location.hash.replace("#/", "").replace("#", "");
  return (["trips", "places", "ideas", "draw", "settings"] as const).find((t) => t === h) ?? "trips";
}

export function App() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { me, people, loading, error, reload } = useData();
  const [tab, setTab] = useState<TabId>(currentTab);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (t: TabId) => {
    location.hash = `/${t}`;
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/trips">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          NextTrip
        </a>
        <nav className="tabs desktop-only">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          {me && (
            <button className="me-chip" onClick={() => setPicking(true)} title="Switch person">
              <span className="dot" style={{ background: me.color }} />
              {me.name}
            </button>
          )}
          <button className={`icon-btn ${tab === "settings" ? "active" : ""}`} onClick={() => go("settings")} aria-label="Settings">
            ⚙️
          </button>
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
            {tab === "trips" && <TripsView />}
            {tab === "places" && <PlacesView />}
            {tab === "ideas" && <IdeasView />}
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

      {!loading && people.length > 0 && (!me || picking) && <PersonPicker onDone={() => setPicking(false)} />}
    </div>
  );
}
