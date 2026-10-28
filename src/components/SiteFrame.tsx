// The header and footer around every signed-out page, and the links they share with Settings.
import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import hubLinks from "../../content/hub-links.json";
import { destinationPath } from "../../shared/seo";
import { FEATURED } from "../site";

/** The page frame for signed-out pages other than the home page: the home page's header and footer around the content. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="lp">
      <SiteHeader />
      <main className="lp-wrap lp-frame">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** The sections the header links to, so a page can light up the one it belongs to. */
export type SiteSection = "how" | "inspire" | "picker" | "blog";

const NAV: { id: SiteSection; label: string; href: string }[] = [
  { id: "how", label: "How it works", href: "/how-it-works" },
  { id: "inspire", label: "Destinations", href: "/destinations" },
  { id: "picker", label: "Holiday picker", href: "/holiday-picker" },
  { id: "blog", label: "Blog", href: "/blog" },
];

/**
 * The signed-out header, the same on every public page. `current` lights up the section the page is in;
 * `exact` says the page is that section's front page. On the home page sign-in scrolls rather than reloads.
 */
export function SiteHeader({ current, exact = false, home = false }: { current?: SiteSection; exact?: boolean; home?: boolean }) {
  const signin = home ? { href: "#signin", onClick: jump } : { href: "/#signin" };
  return (
    <header className="lp-top">
      <div className="lp-wrap lp-top-inner">
        <a className="lp-brand" href="/">
          somewhere<span aria-hidden>🎉</span>
        </a>
        <nav className="lp-nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.id} className={n.id === "inspire" ? "lp-nav-keep" : undefined} href={n.href} aria-current={n.id === current ? (exact ? "page" : "true") : undefined}>
              {n.label}
            </a>
          ))}
          <a {...signin}>Sign in</a>
        </nav>
        <a className="btn" {...signin}>
          Start planning
        </a>
      </div>
    </header>
  );
}

/** Our social accounts, linked from the footer on public pages and from Settings. */
const SOCIAL_LINKS = [
  { name: "Instagram", href: "https://instagram.com/somewhereparty" },
  { name: "TikTok", href: "https://www.tiktok.com/@somewhereparty" },
  { name: "Pinterest", href: "https://pinterest.com/somewhereparty" },
];
export const INSTAGRAM = SOCIAL_LINKS[0].href;
/** Where people get in touch. Every "Contact us" link goes here. */
export const CONTACT_EMAIL = "hello@somewhere.party";

/** Line icons for the social links, drawn in the text colour. */
const SOCIAL_ICONS: Record<string, ReactNode> = {
  Instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </>
  ),
  TikTok: (
    <>
      <path d="M14 3v11.5a4 4 0 1 1-4-4" />
      <path d="M14 3c.4 2.9 2.4 4.8 5.5 5" />
    </>
  ),
  Pinterest: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.8 21l2.1-8.4" />
      <path d="M9.3 13.6c-.6-.7-.9-1.6-.9-2.6 0-2.4 1.9-4.1 4.2-4.1 2.2 0 3.8 1.4 3.8 3.5 0 2.4-1.3 4.2-3.1 4.2-.9 0-1.6-.6-1.4-1.5" />
    </>
  ),
};

/** The Instagram glyph, drawn in the text colour. */
export function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {SOCIAL_ICONS.Instagram}
    </svg>
  );
}

/** Creators who endorse us, edited at /admin. Nothing shows until the first one is added. */
export function FeaturedCreators({ more = true }: { more?: boolean }) {
  const { kicker, heading, link_text, creators } = FEATURED;
  if (!creators.length) return null;
  return (
    <section id="creators" className="lp-wrap lp-section">
      <div className="lp-heading">
        {kicker && <span className="lp-kicker">{kicker}</span>}
        {heading && <h2>{heading}</h2>}
      </div>
      <ul className="lp-creators">
        {creators.map((c) => (
          <li key={c.handle} className="lp-creator">
            <div className="lp-creator-head">
              {c.photo ? (
                <img className="lp-creator-photo" src={c.photo} alt="" width="56" height="56" loading="lazy" />
              ) : (
                <span className="lp-creator-photo" aria-hidden>
                  {c.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="lp-creator-who">
                <strong>{c.name}</strong>
                <a href={c.url} target="_blank" rel="noopener">
                  @{c.handle}
                </a>
              </div>
            </div>
            {c.quote && <blockquote>{c.quote}</blockquote>}
          </li>
        ))}
      </ul>
      {more && link_text && (
        <a className="lp-creators-more" href="/creators">
          {link_text} →
        </a>
      )}
    </section>
  );
}

function SocialLinks() {
  return (
    <>
      {SOCIAL_LINKS.map((s) => (
        <a key={s.name} href={s.href} target="_blank" rel="noopener me">
          {s.name}
        </a>
      ))}
    </>
  );
}

/** A copy of the list in a random order (Fisher-Yates). */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const HUB_LINKS: { slug: string; name: string; icon: string }[] = hubLinks;

/**
 * The footer on every public page. The hub pages it links to are picked at random once the page is up,
 * from the list scripts/hub-links.mjs makes at each build, so the prerendered page stays the same and
 * nothing is fetched. That list is small, so pages don't carry every guide just for these links.
 * The "Start planning" banner is for people who aren't signed in.
 */
export function SiteFooter({ sections = false, signedIn = false }: { sections?: boolean; signedIn?: boolean }) {
  const [picks, setPicks] = useState(() => HUB_LINKS.slice(0, 3));
  useEffect(() => setPicks(shuffled(HUB_LINKS).slice(0, 3)), []);
  // On the home page the section links scroll; elsewhere they go to the home page.
  const home = (id: string) => (sections ? { href: `#${id}`, onClick: jump } : { href: `/#${id}` });

  return (
    <footer className="lp-foot">
      <div className="lp-wrap lp-foot-inner">
        {!signedIn && (
          <section aria-label="Start planning" className="lp-foot-board">
            <div className="lp-foot-board-text">
              <div className="lp-foot-board-head">
                <span>NEXT DEPARTURE</span>
                <span className="lp-foot-board-lit">● NOW BOARDING</span>
              </div>
              <p className="lp-foot-board-title">Your next holiday is somewhere.</p>
              <p className="lp-foot-board-sub">Pool your ideas, spread your points in secret, and let the draw pick where you go.</p>
            </div>
            <a className="lp-foot-board-btn" {...home("signin")}>
              Start planning <span className="lp-foot-board-free">FREE</span>
            </a>
          </section>
        )}

        <div className="lp-foot-cols">
          <div className="lp-foot-about">
            <a className="lp-brand" href="/" aria-label="somewhere.party home">
              somewhere<span aria-hidden>🎉</span>
            </a>
            <p className="lp-foot-tagline">Where we've been, and where we're going next.</p>
            <p className="lp-foot-note">Free for the whole family. One of you signs in with your email, then shares a link with everyone else.</p>
            <ul className="lp-foot-social" aria-label="Follow somewhere.party">
              {SOCIAL_LINKS.map((s) => (
                <li key={s.name}>
                  <a href={s.href} target="_blank" rel="noopener me" aria-label={`somewhere.party on ${s.name}`}>
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {SOCIAL_ICONS[s.name]}
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="About" className="lp-foot-col">
            <h2 className="lp-foot-label">ABOUT</h2>
            <ul>
              <li>
                <a href="/how-it-works">How it works</a>
              </li>
              <li>
                <a {...home("features")}>Features</a>
              </li>
              <li>
                <a {...home("why")}>Why use it</a>
              </li>
              <li>
                <a href="/how-to-decide-where-to-go-on-holiday">Deciding where to go</a>
              </li>
              <li>
                <a href="/blog">Blog</a>
              </li>
              <li>
                <a href="/airports">Airport guides</a>
              </li>
              <li>
                <a href="/about">About us</a>
              </li>
              <li>
                <a href="/faq">FAQ</a>
              </li>
              <li>
                <a href="/creators">Creators</a>
              </li>
            </ul>
          </nav>

          {HUB_LINKS.length > 0 && (
            <nav aria-label="Holiday ideas" className="lp-foot-col">
              <h2 className="lp-foot-label">HOLIDAY IDEAS</h2>
              <ul>
                {picks.map((d) => (
                  <li key={d.slug}>
                    <a href={destinationPath(d.slug)}>
                      <span aria-hidden>{d.icon}</span> {d.name}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/holiday-picker">
                    <span aria-hidden>🎟️</span> Random holiday picker
                  </a>
                </li>
                <li>
                  <a className="lp-foot-all" href="/destinations">
                    All destinations →
                  </a>
                </li>
              </ul>
            </nav>
          )}

          <nav aria-label="The small print" className="lp-foot-col">
            <h2 className="lp-foot-label">SMALL PRINT</h2>
            <ul>
              <li>
                <a {...home("signin")}>Sign in</a>
              </li>
              <li>
                <a href="/privacy">Privacy policy</a>
              </li>
              <li>
                <a href="/terms">Terms of use</a>
              </li>
              <li>
                <a href="/how-we-make-money">How we make money</a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="lp-foot-tear" aria-hidden="true" />

      <div className="lp-wrap lp-foot-base">
        <p>© {new Date().getFullYear()} somewhere.party</p>
        <p className="lp-foot-label">ADMIT ONE FAMILY · ANY DESTINATION</p>
      </div>
    </footer>
  );
}

export function LegalLinks() {
  return (
    <footer className="legal-links muted small">
      <SocialLinks />
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </footer>
  );
}

/** Scrolls to a section of the home page without touching the hash, which the signed-in app uses for its tabs. */
function jump(e: MouseEvent<HTMLAnchorElement>) {
  const id = e.currentTarget.getAttribute("href")?.slice(1);
  const el = id && document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
