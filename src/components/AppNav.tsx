import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, RefObject } from "react";
import type { Person } from "../../shared/types";

export const TABS = [
  { id: "been", label: "Been", icon: "🧳" },
  { id: "places", label: "Places", icon: "🗺️" },
  { id: "next", label: "Next", icon: "💡" },
  { id: "draw", label: "Draw", icon: "🎟️" },
] as const;

export type TabId = (typeof TABS)[number]["id"] | "settings";
/** "explore" is any other public page a signed-in family is reading: the blog, the holiday picker, How it works… */
type Current = TabId | "guides" | "explore";

/** The rest of the site, behind Explore: the two worth a visit first, then the help pages. */
const EXPLORE = [
  { href: "/holiday-picker", label: "Holiday picker", note: "Five questions, one random destination" },
  { href: "/blog", label: "Blog", note: "Help deciding where to go" },
];
const HELP = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

/** Closes a menu on Escape or on a click outside `inside`. */
function useDismiss(open: boolean, close: () => void, inside: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => !inside.current?.contains(e.target as Node) && close();
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onDown);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", onDown);
    };
  }, [open, close, inside]);
}

function ExploreLinks({ onPick }: { onPick: () => void }) {
  const here = typeof location === "undefined" ? "" : location.pathname;
  return (
    <>
      {EXPLORE.map((l) => (
        <a key={l.href} className="explore-link" href={l.href} aria-current={here.startsWith(l.href) ? "page" : undefined} onClick={onPick}>
          <b>{l.label}</b>
          <small>{l.note}</small>
        </a>
      ))}
    </>
  );
}

function HelpLinks({ onPick }: { onPick: () => void }) {
  return (
    <div className="explore-help">
      {HELP.map((l) => (
        <a key={l.href} href={l.href} onClick={onPick}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

/** Desktop: the last item in the tabs, opening a small list of the rest of the site. */
function ExploreMenu({ current }: { current: Current }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useDismiss(open, close, box);
  return (
    <div className="explore" ref={box}>
      <button type="button" className={current === "explore" ? "active" : ""} aria-expanded={open} aria-controls="explore-menu" onClick={() => setOpen(!open)}>
        Explore
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>
      {open && (
        <nav id="explore-menu" className="explore-drop" aria-label="Explore">
          <ExploreLinks onPick={close} />
          <HelpLinks onPick={close} />
        </nav>
      )}
    </div>
  );
}

/** Phones: a menu button in the top bar, opening a sheet with the rest of the site and Settings. */
function PhoneMenu({ current, go }: { current: Current; go?: (t: TabId) => void }) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const close = () => setOpen(false);
  useDismiss(open, close, sheet);
  return (
    <>
      <button
        type="button"
        className={`icon-btn menu-btn mobile-only ${current === "explore" || current === "settings" ? "active" : ""}`}
        aria-expanded={open}
        aria-controls="phone-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {/* On the body, as the top bar's blur would otherwise hold the sheet inside the bar. */}
      {open &&
        createPortal(
        <div className="phone-menu-scrim mobile-only">
          <nav id="phone-menu" className="phone-menu" aria-label="Menu" ref={sheet}>
            <span className="phone-menu-grab" aria-hidden />
            <span className="mono-label">Explore somewhere🎉</span>
            <ExploreLinks onPick={close} />
            {go ? (
              <button
                type="button"
                className="explore-link"
                onClick={() => {
                  close();
                  go("settings");
                }}
              >
                <b>Settings</b>
                <small>Your family, links, home airport and theme</small>
              </button>
            ) : (
              <a className="explore-link" href="/#/settings">
                <b>Settings</b>
                <small>Your family, links, home airport and theme</small>
              </a>
            )}
            <HelpLinks onPick={close} />
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}

/**
 * A tab: inside the app a button that switches tabs in place, and on the guide pages a link back
 * into the app. Destinations is always a link, as it's its own page.
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

/** The signed-in header, the same in the app, on the Guides pages and on the rest of the site. Settings moves into the menu on phones. */
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
          <GuidesTab current={current}>Destinations</GuidesTab>
          <ExploreMenu current={current} />
        </nav>
        <div className="topbar-right">
          {me && (
            <a className="me-chip" href={go ? "#/settings" : "/#/settings"} title="You, on this device">
              <span className="dot" style={{ background: me.color }} />
              {me.name}
            </a>
          )}
          {go ? (
            <button className={`icon-btn desktop-only ${current === "settings" ? "active" : ""}`} onClick={() => go("settings")} aria-label="Settings">
              ⚙️
            </button>
          ) : (
            <a className="icon-btn desktop-only" href="/#/settings" aria-label="Settings">
              ⚙️
            </a>
          )}
          <PhoneMenu current={current} go={go} />
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
        Destinations
      </GuidesTab>
    </nav>
  );
}
