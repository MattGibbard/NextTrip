import { useEffect, useState } from "react";
import type { Person } from "../../shared/types";
import { load } from "../storage";
import { AppBottomNav, AppTopbar } from "./AppNav";
import type { TabId } from "./AppNav";

// While the signed-in app and the family's things are on their way, people see the app's own header
// and bottom bar with grey shapes where the page will be, instead of a bare "Loading…".

/** Who this browser was last time, so the name in the header is there from the start. */
export const LAST_ME = "lastMe";

function currentTab(): TabId {
  const first = location.hash.replace(/^#\/?/, "").split("/")[0];
  return (["been", "places", "next", "draw", "settings"] as const).find((t) => t === first) ?? "been";
}

/** Grey shapes in place of a page: a heading and a grid of cards. */
export function PageSkeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      <div className="sk-bar sk-eyebrow" />
      <div className="sk-bar sk-title" />
      <div className="sk-bar sk-sub" />
      <div className="sk-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sk-card" />
        ))}
      </div>
    </div>
  );
}

/** The whole app frame with a page of grey shapes, for before the signed-in app has arrived. */
export function AppSkeleton({ guide = false }: { guide?: boolean }) {
  const me = load<Pick<Person, "name" | "color"> | null>(LAST_ME, null);
  const [tab, setTab] = useState(currentTab);
  useEffect(() => {
    const onHash = () => setTab(currentTab());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const current = guide ? "guides" : tab;
  // Tapping a tab before the app arrives just changes the address; the app opens on that tab.
  const go = (t: TabId) => {
    location.hash = `/${t}`;
  };
  return (
    <div className="app">
      <AppTopbar current={current} me={me} go={go} />
      <main className="content">
        <PageSkeleton />
      </main>
      <AppBottomNav current={current} go={go} />
    </div>
  );
}
