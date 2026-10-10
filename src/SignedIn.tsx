import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./draw.css";
import "./onboarding.css";
import "./postcard.css";
import "./share.css";
import type { FamilyData, Person } from "../shared/types";
import type { SignedInSession } from "./lastFamily";
import { DataProvider, useData } from "./data";
import { findDestination } from "./destinations";
import { TripsView } from "./views/TripsView";
import { PlacesView } from "./views/PlacesView";
import { ShareMapView } from "./views/ShareMapView";
import { IdeasView } from "./views/IdeasView";
import { DrawView } from "./views/DrawView";
import { SettingsView } from "./views/SettingsView";
import { IdeaPage } from "./views/IdeaPage";
import { TripPage } from "./views/TripPage";
import { Onboarding } from "./views/Onboarding";
import { GuideView } from "./views/GuideView";
import { PersonPicker } from "./components/PersonPicker";
import { AppBottomNav, AppTopbar } from "./components/AppNav";
import type { TabId } from "./components/AppNav";
import { isGuidePath } from "./navigate";
import { LAST_ME, PageSkeleton } from "./components/AppSkeleton";
import { load, save } from "./storage";

// The signed-in app. App.tsx loads this on its own, once someone is signed in, so visitors to the
// public pages never download it.

/** The signed-in app for a family member. */
export default function SignedIn({ session, path, initial, stale }: { session: SignedInSession; path: string; initial: FamilyData | null; stale: boolean }) {
  return (
    <DataProvider session={session} initial={initial} stale={stale}>
      <Shell path={path} />
    </DataProvider>
  );
}

/**
 * Reads routes like #/next or #/next/12, and #/next/add/new-york from a destination guide's "Add to ideas".
 * #/welcome replays the welcome steps from Settings. #/places/share makes a picture of the map to post.
 */
function currentRoute(): { tab: TabId; id: number | null; add: string | null; welcome: boolean; share: boolean } {
  const [first, second, third] = location.hash.replace(/^#\/?/, "").split("/");
  const tab = (["been", "places", "next", "draw", "settings"] as const).find((t) => t === first) ?? "been";
  const id = Number(second);
  const add = second === "add" && third && findDestination(third) ? third : null;
  return { tab, id: Number.isInteger(id) && id > 0 ? id : null, add, welcome: first === "welcome", share: tab === "places" && second === "share" };
}

function Shell({ path }: { path: string }) {
  const { me, ideas, home, loading, error, reload } = useData();
  const [route, setRoute] = useState(currentRoute);
  // Someone new sees the welcome steps once; the server remembers when they've been through them.
  const [welcomed, setWelcomed] = useState(false);
  const tab = route.tab;

  // Remembered so the header shows who you are straight away next time, while the app loads.
  useEffect(() => {
    if (me) save(LAST_ME, { name: me.name, color: me.color });
  }, [me]);

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
      {/* Until the family's things arrive, keep showing who you were last time so the name doesn't blink out. */}
      <AppTopbar current={tab} me={me ?? (loading ? load<Pick<Person, "name" | "color"> | null>(LAST_ME, null) : null)} go={go} />

      <main className="content">
        {error && (
          <div className="banner error">
            {error} <button onClick={() => void reload()}>Retry</button>
          </div>
        )}
        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {tab === "been" && (route.id ? <TripPage key={route.id} id={route.id} /> : <TripsView addFrom={route.add} />)}
            {tab === "places" && (route.share ? <ShareMapView /> : <PlacesView />)}
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
