import type { ReactNode } from "react";
import type { Person } from "../../shared/types";

export const TABS = [
  { id: "been", label: "Been", icon: "🧳" },
  { id: "places", label: "Places", icon: "🗺️" },
  { id: "next", label: "Next", icon: "💡" },
  { id: "draw", label: "Draw", icon: "🎟️" },
] as const;

export type TabId = (typeof TABS)[number]["id"] | "settings";
type Current = TabId | "guides";

/**
 * A tab: inside the app a button that switches tabs in place, and on the guide pages a link back
 * into the app. Inspire is always a link, as it's its own page.
 */
function Tab({ id, current, go, children }: { id: TabId; current: Current; go?: (t: TabId) => void; children: ReactNode }) {
  const active = current === id;
  return go ? (
    <button className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={() => go(id)}>
      {children}
    </button>
  ) : (
    <a className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={`/#/${id}`}>
      {children}
    </a>
  );
}

function GuidesTab({ current, children }: { current: Current; children: ReactNode }) {
  return (
    <a className={current === "guides" ? "active" : ""} aria-current={current === "guides" ? "page" : undefined} href="/destinations">
      {children}
    </a>
  );
}

/** The signed-in header, the same in the app and on the Guides pages. */
export function AppTopbar({ current, me, go }: { current: Current; me: Pick<Person, "name" | "color"> | null; go?: (t: TabId) => void }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href={go ? "#/been" : "/#/been"}>
          somewhere<span aria-hidden>🎉</span>
        </a>
        <nav className="tabs desktop-only" aria-label="Main">
          {TABS.map((t) => (
            <Tab key={t.id} id={t.id} current={current} go={go}>
              {t.label}
            </Tab>
          ))}
          <GuidesTab current={current}>Inspire</GuidesTab>
        </nav>
        <div className="topbar-right">
          {me && (
            <a className="me-chip" href={go ? "#/settings" : "/#/settings"} title="You, on this device">
              <span className="dot" style={{ background: me.color }} />
              {me.name}
            </a>
          )}
          {go ? (
            <button className={`icon-btn ${current === "settings" ? "active" : ""}`} onClick={() => go("settings")} aria-label="Settings">
              ⚙️
            </button>
          ) : (
            <a className="icon-btn" href="/#/settings" aria-label="Settings">
              ⚙️
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

/** The signed-in bottom bar on phones. */
export function AppBottomNav({ current, go }: { current: Current; go?: (t: TabId) => void }) {
  return (
    <nav className="bottom-nav mobile-only" aria-label="Main">
      {TABS.map((t) => (
        <Tab key={t.id} id={t.id} current={current} go={go}>
          <span className="icon">{t.icon}</span>
          {t.label}
        </Tab>
      ))}
      <GuidesTab current={current}>
        <span className="icon">🧭</span>
        Inspire
      </GuidesTab>
    </nav>
  );
}
