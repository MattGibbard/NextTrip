import { useEffect, useState } from "react";
// The app's own styles, in the order they used to load in styles.css (later files win a clash).
import "./styles/forms.css"; /* Forms and modals. */
import "./styles/trip-sheet.css"; /* The add and edit sheets for trips and ideas. */
import "./styles/person-picker.css"; /* Choosing which family member you are. */
import "./styles/app.css"; /* Signed-in odds and ends: the draw, idea details, filters, the idea page and swiping. */
import "./styles/tickets.css"; /* The boarding-pass look: tickets, stats, the next departure and standby idea cards. */
import "./styles/places.css"; /* The Places tab: coverage and passport stamps. */
import "./styles/settings.css"; /* The Settings page. */
import "./styles/plan.css"; /* A won idea's trip plan: days, costs, packing and jobs before you go. */
import "./styles/book-links.css"; /* Find flights and hotels (affiliate links). */
import "leaflet/dist/leaflet.css";
import "./styles/draw.css";
import "./styles/onboarding.css";
import "./styles/postcard.css";
import "./styles/share.css";
import type { FamilyData, IdeaInput, Person } from "../shared/types";
import type { SignedInSession } from "./lastFamily";
import { DataProvider, useData } from "./data";
import { findDestination, ideaFromDestination } from "./destinations";
import { PICKED_IDEA } from "./picker";
import { api } from "./api";
import { TripsView } from "./views/TripsView";
import { PlacesView } from "./views/PlacesView";
import { ShareMapView } from "./views/ShareMapView";
import { IdeasView } from "./views/IdeasView";
import { DrawView } from "./views/DrawView";
import { SettingsView } from "./views/SettingsView";
import { IdeaPage } from "./views/IdeaPage";
import { TripPage } from "./views/TripPage";
import { PlanPage } from "./views/plan/PlanPage";
import { PLAN_TABS } from "./views/plan/context";
import type { PlanTab } from "./views/plan/context";
import { Onboarding } from "./views/Onboarding";
import { GuideView } from "./views/GuideView";
import { PersonPicker } from "./components/PersonPicker";
import { AppBottomNav, AppTopbar } from "./components/AppNav";
import type { TabId } from "./components/AppNav";
import { isGuidePath } from "./navigate";
import { LAST_ME, PageSkeleton } from "./components/AppSkeleton";
import { forget, load, save } from "./storage";

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
 * #/next/12/plan is a won idea's trip plan, and #/next/12/plan/costs one of its tabs.
 * #/welcome replays the welcome steps from Settings. #/places/share makes a picture of the map to post.
 */
function currentRoute(): { tab: TabId; id: number | null; add: string | null; plan: PlanTab | null; welcome: boolean; share: boolean } {
  const [first, second, third, fourth] = location.hash.replace(/^#\/?/, "").split("/");
  const tab = (["been", "places", "next", "draw", "settings"] as const).find((t) => t === first) ?? "been";
  const id = Number(second);
  const add = second === "add" && third && findDestination(third) ? third : null;
  const plan = tab === "next" && third === "plan" ? (PLAN_TABS.find((t) => t.id === fourth)?.id ?? "overview") : null;
  return { tab, id: Number.isInteger(id) && id > 0 ? id : null, add, plan, welcome: first === "welcome", share: tab === "places" && second === "share" };
}

function Shell({ path }: { path: string }) {
  const { me, ideas, home, loading, error, reload } = useData();
  const [route, setRoute] = useState(currentRoute);
  // Someone new sees the welcome steps once; the server remembers when they've been through them.
  const [welcomed, setWelcomed] = useState(false);
  const tab = route.tab;

  // A guide saved from the holiday picker before signing in goes on the Next list once they're in.
  useEffect(() => {
    if (loading || error || !me) return;
    const d = findDestination(load<string>(PICKED_IDEA, ""));
    forget(PICKED_IDEA);
    if (!d || ideas.some((i) => i.status === "active" && i.title === d.name)) return;
    void api
      .createIdea({ ...ideaFromDestination(d), title: d.name, description: null, created_by: me.id, depart: null, travel_time: null } as IdeaInput)
      .then(() => reload(["ideas"]))
      .then(() => {
        // Someone new sees the welcome steps first, which end on the Next list anyway.
        if (me.onboarded) location.hash = "/next";
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, me?.id]);

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
            {tab === "next" &&
              (route.id && route.plan ? (
                <PlanPage key={route.id} id={route.id} tab={route.plan} />
              ) : route.id ? (
                <IdeaPage key={route.id} id={route.id} />
              ) : (
                <IdeasView addFrom={route.add} />
              ))}
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
