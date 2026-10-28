import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, MouseEvent, ReactNode } from "react";
import { api } from "../api";
import { HOME, POPULAR } from "../site";
import { destinationPath } from "../../shared/seo";
import { PERSON_COLORS } from "../../shared/auth";
import { photoProps } from "../photos";
import { turnstileToken, warmTurnstile } from "../turnstile";
import { FeaturedCreators, SiteFooter, SiteHeader } from "../components/SiteFrame";
import "../styles/home-journey.css";

/** Text from the editor, where **two stars** make words bold and [words](/address) makes a link to a page on the site. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*.+?\*\*|\[[^\]]+\]\((?:\/|https:\/\/)[^)\s]*\))/g).map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) return <a key={i} href={link[2]}>{link[1]}</a>;
        return part;
      })}
    </>
  );
}

/** A custom property for the stylesheet, such as a ticket's tilt. */
const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** The public front page: one idea's journey from the family's list to the trip, with the sign-up form at the top. */
export function HomePage() {
  const { hero, journey, postcards, faq, cta } = HOME;
  const root = useAnimatedChapters();
  return (
    <div className="lp lp-home hj" ref={root}>
      <SiteHeader home />

      <main>
        <section id="signin" className="hj-hero">
          <HeroTickets />
          <div className="lp-wrap hj-hero-text">
            {hero.kicker && <div className="lp-kicker">{hero.kicker}</div>}
            <h1>{hero.heading}</h1>
            {hero.lead && <p className="lp-lead">{hero.lead}</p>}
            <SignInForm id="hero-email" button={hero.button || "Start your list"} note={hero.note} />
          </div>
          <HeroTickets phone="below" />
        </section>

        <section id="how" className="hj-journey" aria-labelledby="how-heading">
          <div className="lp-wrap hj-intro">
            {journey.kicker && <div className="lp-kicker">{journey.kicker}</div>}
            <h2 id="how-heading">{journey.heading}</h2>
          </div>
          <Chapter n={1} words={journey.standby} visual={<PoolVisual />} />
          <Chapter n={2} words={journey.points} visual={<PointsVisual />} flip />
          <Chapter n={3} words={journey.draw} visual={<BoardVisual />} />
          <Chapter n={4} words={journey.plan} visual={<PlanVisual />} flip />
        </section>

        <section className="lp-wrap hj-after">
          <div className="hj-after-text">
            {postcards.kicker && <div className="lp-kicker">{postcards.kicker}</div>}
            <h2>{postcards.heading}</h2>
            {postcards.text && <p className="lp-lead">{postcards.text}</p>}
          </div>
          <Postcards />
        </section>

        <PopularGuides />

        <FeaturedCreators />

        {faq.questions.length > 0 && (
          <section id="faq" className="hj-faq">
            <div className="lp-wrap hj-faq-inner">
              <h2>{faq.heading}</h2>
              {faq.questions.map((q, i) => (
                <details key={q.question} open={i === 0}>
                  <summary>{q.question}</summary>
                  <p>
                    <Rich text={q.answer} />
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="lp-wrap hj-cta">
          <h2>{cta.heading}</h2>
          <a className="btn" href="#signin" onClick={toForm}>
            {cta.button || "Start planning"}
          </a>
        </section>
      </main>

      <SiteFooter sections />
    </div>
  );
}

/** Back up to the sign-up box, with the cursor in it. */
function toForm(e: MouseEvent<HTMLAnchorElement>) {
  const input = document.getElementById("hero-email");
  if (!input) return;
  e.preventDefault();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("signin")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  input.focus({ preventScroll: true });
}

/**
 * Plays each chapter's picture as it scrolls into view. The page is prerendered with everything showing,
 * so the hidden starting frames only switch on once this runs, and never for people who ask for less motion.
 */
function useAnimatedChapters() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chapters = [...el.querySelectorAll<HTMLElement>(".hj-chapter")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.2 },
    );
    // Chapters already scrolled past (coming back to the page) stay as they are.
    for (const c of chapters) if (c.getBoundingClientRect().bottom < 0) c.classList.add("is-in");
    el.classList.add("hj-anim");
    for (const c of chapters) if (!c.classList.contains("is-in")) io.observe(c);
    return () => io.disconnect();
  }, []);
  return root;
}

function Chapter({ n, words, visual, flip = false }: { n: number; words: { title: string; text: string }; visual: ReactNode; flip?: boolean }) {
  return (
    <div className={flip ? "lp-wrap hj-chapter flip" : "lp-wrap hj-chapter"}>
      <div className="hj-chapter-text">
        <span className={n === 1 ? "hj-num standby" : "hj-num"} aria-hidden>
          {String(n).padStart(2, "0")}
        </span>
        <h3>
          <span className="visually-hidden">Step {n}: </span>
          {words.title}
        </h3>
        {words.text && (
          <p>
            <Rich text={words.text} />
          </p>
        )}
      </div>
      <div className="hj-visual-wrap" aria-hidden>
        {visual}
      </div>
    </div>
  );
}

/**
 * A standby ticket: an idea someone in the family has put on the list. Ella's Lake Garda ticket is the one
 * the page follows, so it turns up in every chapter.
 */
function Ticket({ from, place, meta, className = "", style }: { from: string; place: string; meta?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`hj-ticket ${className}`} style={style}>
      <span className="hj-ticket-stub" />
      <div className="hj-ticket-body">
        <span className="hj-ticket-from">{from}</span>
        <strong>{place}</strong>
        {meta && <span className="hj-ticket-meta">{meta}</span>}
      </div>
    </div>
  );
}

const GARDA = "🇮🇹 Lake Garda";

/** The made-up family's ideas around the headline. Six around it on a computer, three above and two below on a phone. */
const HERO_TICKETS = [
  { from: "Ella", place: GARDA, meta: "🏖️ Beach · £££", at: { left: "4%", top: "70px" }, tilt: -7, phone: "above" },
  { from: "Dad", place: "🇳🇴 Northern lights", meta: "🥾 Nature & hiking · £££", at: { left: "8%", top: "300px" }, tilt: 5, phone: "above" },
  { from: "Sam", place: "🇫🇷 Disneyland Paris", meta: "🚆 3 hours by train", at: { left: "2%", top: "500px" }, tilt: -3, phone: "below" },
  { from: "Mum", place: "🇯🇵 Kyoto in blossom", meta: "🏙️ City break · £££", at: { right: "4%", top: "90px" }, tilt: 6, phone: "above" },
  { from: "Ella", place: "🇬🇷 Crete", meta: "🏖️ Beach · ££", at: { right: "9%", top: "320px" }, tilt: -5, phone: "below" },
  { from: "Dad", place: "🇮🇹 Rome and Naples", meta: "🏙️ City break · ££", at: { right: "3%", top: "520px" }, tilt: 3, phone: null },
] as const;

/** Decoration, so screen readers skip it. Without `phone` these are the computer's six; with it, a phone's row above or below the form. */
function HeroTickets({ phone }: { phone?: "below" }) {
  if (!phone) {
    return (
      <div className="hj-floats" aria-hidden>
        {HERO_TICKETS.map((t, i) => (
          <div key={i} className="hj-float" style={vars({ ...t.at, "--r": `${t.tilt}deg`, "--from": "left" in t.at ? -1 : 1, "--i": i })}>
            <Ticket from={`From ${t.from}`} place={t.place} meta={t.meta} />
          </div>
        ))}
        <div className="hj-strip above">
          {HERO_TICKETS.filter((t) => t.phone === "above").map((t, i) => (
            <div key={i} className="hj-float" style={vars({ "--r": `${t.tilt}deg`, "--from": i === 1 ? 1 : -1, "--i": i })}>
              <Ticket from={`From ${t.from}`} place={t.place.replace(" in blossom", "")} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="hj-floats" aria-hidden>
      <div className="hj-strip below">
        {HERO_TICKETS.filter((t) => t.phone === "below").map((t, i) => (
          <div key={i} className="hj-float" style={vars({ "--r": `${t.tilt}deg`, "--from": i ? 1 : -1, "--i": i + 3 })}>
            <Ticket from={`From ${t.from}`} place={t.place} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A piece of a chapter's picture that builds in turn. */
const step = (i: number) => vars({ "--i": i });

/** 01: Ella's new idea drops into the family's pool. */
function PoolVisual() {
  return (
    <div className="hj-visual hj-pool">
      <Ticket className="hj-garda hj-thread" from="On standby · added by Ella" place={GARDA} meta="🏖️ Beach · ✈️ 2h 10m · 7 nights · £££" style={vars({ "--r": "0deg" })} />
      {["🇯🇵 Kyoto", "🇳🇴 Northern lights", "🇫🇷 Disneyland Paris", "🇬🇷 Crete"].map((p, i) => (
        <div key={p} className="hj-pool-idea hj-piece drop" style={step(i + 1)}>
          {p}
        </div>
      ))}
    </div>
  );
}

const [MUM, ELLA, DAD, SAM] = PERSON_COLORS;

/** 02: the others lock in their points while Ella shares out hers, with a veto. */
function PointsVisual() {
  return (
    <div className="hj-visual hj-points">
      {[
        { name: "Mum", color: MUM },
        { name: "Dad", color: DAD },
      ].map((p, i) => (
        <div key={p.name} className="hj-person hj-piece lock" style={step(i)}>
          <span className="hj-person-name">
            <span className="hj-dot" style={{ background: p.color }} />
            <strong>{p.name}</strong>
          </span>
          <span className="hj-locked">✓ Locked in</span>
        </div>
      ))}
      <div className="hj-mine hj-piece lock" style={step(2)}>
        <div className="hj-mine-head">
          <span className="hj-person-name">
            <span className="hj-dot" style={{ background: ELLA }} />
            <strong>Ella · your points</strong>
          </span>
          <span className="hj-left">9 left</span>
        </div>
        <div className="hj-mine-row garda">
          <Ticket className="hj-garda hj-thread mini" from="From Ella" place={GARDA} style={vars({ "--r": "-2deg" })} />
          <strong>10</strong>
        </div>
        <div className="hj-mine-row hj-piece" style={step(4)}>
          <span>🇬🇷 Crete</span>
          <strong>4</strong>
        </div>
        <div className="hj-mine-row veto hj-piece stamp" style={step(5)}>
          <span>🇳🇴 Northern lights</span>
          <strong>🚫 Veto</strong>
        </div>
      </div>
      <div className="hj-person waiting hj-piece lock" style={step(6)}>
        <span className="hj-person-name">
          <span className="hj-dot" style={{ background: SAM }} />
          <strong>Sam</strong>
        </span>
        <span className="muted">is still choosing…</span>
      </div>
    </div>
  );
}

/** 03: the departures board. Lake Garda boards; the rest are delayed or vetoed. */
const BOARD = [
  { code: "VRN", place: GARDA, status: "Boarding 🏆", kind: "win" },
  { code: "HER", place: "🇬🇷 Crete", status: "Delayed", kind: "late" },
  { code: "KIX", place: "🇯🇵 Kyoto", status: "Delayed", kind: "late" },
  { code: "TOS", place: "🇳🇴 Northern lights", status: "Vetoed", kind: "off" },
] as const;

function BoardVisual() {
  return (
    <div className="hj-visual hj-board">
      <div className="hj-board-head">
        <span>Departures · summer 2027</span>
        <span>Status</span>
      </div>
      {BOARD.map((r, row) => (
        <div key={r.code} className={`hj-board-row ${r.kind}`} style={step(row)}>
          <span className="hj-tiles">
            {[...r.code].map((c, i) => (
              <span key={i} className="hj-tile" style={step(row * 3 + i)}>
                {c}
              </span>
            ))}
          </span>
          {r.kind === "win" ? <Ticket className="hj-garda hj-thread mini" from="From Ella" place={GARDA} style={vars({ "--r": "0deg" })} /> : <span className="hj-board-place">{r.place}</span>}
          <span className="hj-board-status">{r.status}</span>
        </div>
      ))}
    </div>
  );
}

/** 04: the winner's boarding pass, with the days of the itinerary ticking in. */
function PlanVisual() {
  const days = ["Fly to Verona, drive to Garda", "Beach day at Baia delle Sirene", "Ferry to Sirmione", "Gardaland"];
  return (
    <div className="hj-visual hj-plan">
      <Ticket className="hj-garda hj-thread mini pinned" from="From Ella" place={GARDA} style={vars({ "--r": "-6deg" })} />
      <div className="hj-pass">
        <div className="hj-pass-head">
          <div>
            <span className="hj-pass-label">Boarding pass</span>
            <strong>{GARDA}</strong>
          </div>
          <div className="end">
            <span className="hj-pass-label">Departs in</span>
            <strong>213 days</strong>
          </div>
        </div>
        <div className="hj-pass-tabs">
          <span>Overview</span>
          <span className="on">Itinerary</span>
          <span>Costs</span>
          <span>Packing</span>
        </div>
        <ol className="hj-days">
          {days.map((d, i) => (
            <li key={d} className="hj-piece tick" style={step(i + 1)}>
              <span className="hj-day">Day {i + 1}</span>
              <span>{d}</span>
              <span className="hj-tick">✓</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Past trips as postcards, with a passport stamp. */
const POSTCARDS = [
  { photo: "/images/destinations/rome-4124391_1280.webp", size: [1280, 896], title: "🇮🇹 Rome and Naples · 2025", tilt: -6 },
  { photo: "/images/destinations/norwegian-fjords-5240138_1280.webp", size: [1280, 853], title: "🇳🇴 Fjord cruise · 2024", tilt: 4 },
] as const;

function Postcards() {
  return (
    <div className="hj-postcards" aria-hidden>
      {POSTCARDS.map((p) => (
        <div key={p.title} className="hj-postcard" style={vars({ "--r": `${p.tilt}deg` })}>
          <img {...photoProps(p.photo, [...p.size], "260px")} alt="" width={p.size[0]} height={p.size[1]} loading="lazy" decoding="async" />
          <span>{p.title}</span>
        </div>
      ))}
      <span className="hj-stamp">ITA</span>
    </div>
  );
}

function SignInForm({ id, button, note }: { id: string; button: string; note?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const botBox = useRef<HTMLDivElement>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await api.sendSignInEmail(email, await turnstileToken(botBox.current!));
      setDevLink(res.dev_link ?? null);
      setDevCode(res.dev_code ?? null);
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className="panel lp-sent" role="status">
        <p className="big">📬 Check your inbox</p>
        <p>
          We've sent a sign-in link and code to <strong>{email.trim()}</strong>. They work once, for the next 20 minutes. If it isn't there, look in your junk folder.
        </p>
        {devLink && (
          <p className="small">
            Local development: <a href={devLink}>open the sign-in link</a>
            {devCode && <> or use code {devCode}</>}
          </p>
        )}
        <CodeForm id={`${id}-code`} email={email} />
        <button className="link" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form className="lp-form" onSubmit={send}>
      <label htmlFor={id}>Your email</label>
      <div className="lp-form-row">
        <input
          id={id}
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={warmTurnstile}
        />
        <button className="btn" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : button}
        </button>
      </div>
      <div ref={botBox} className="lp-bot-check" />
      {error && <p className="error-text">{error}</p>}
      {note && <p className="hj-note">{note}</p>}
      <p className="muted small">
        Already signed up? This emails you a sign-in link. By continuing you agree to our <a href="/terms">terms</a> and <a href="/privacy">privacy policy</a>.
      </p>
    </form>
  );
}

/**
 * The 6-digit code from the email. Email apps often open links in their own
 * browser, which would sign that in instead of this one, so typing the code
 * here signs in the browser you started in.
 */
function CodeForm({ id, email }: { id: string; email: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.signInWithCode(email, code);
      location.replace("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="lp-form lp-code-form" onSubmit={submit}>
      <label htmlFor={id}>Or enter the code from the email</label>
      <div className="lp-form-row">
        <input
          id={id}
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={7}
          placeholder="123 456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn" disabled={busy}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}

const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "");

/** A few guides picked in the editor (Site > Popular guides), linking into Inspire. Hidden when none are picked. */
function PopularGuides() {
  const { kicker, heading, link_text, guides } = POPULAR;
  if (!guides.length) return null;
  return (
    <section id="guides" className="lp-wrap lp-section">
      <div className="lp-heading">
        {kicker && <span className="lp-kicker">{kicker}</span>}
        {heading && <h2>{heading}</h2>}
      </div>
      <ul className="dx-grid lp-guides">
        {guides.map((g) => (
          <li key={g.slug} className="dx-card">
            <div className="dx-card-photo">
              {g.image ? (
                <img {...photoProps(g.image, g.image_size, "(max-width: 759px) calc(100vw - 32px), 300px")} alt={g.image_alt} width={g.image_size?.[0]} height={g.image_size?.[1]} loading="lazy" />
              ) : (
                <span aria-hidden>{g.name.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div className="dx-card-body">
              <h3>
                <a href={destinationPath(g.slug)}>
                  {flag(g.country_code) && <span aria-hidden>{flag(g.country_code)} </span>}
                  {g.name}
                </a>
              </h3>
              {g.intro && <p className="muted small">{g.intro.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? g.intro}</p>}
            </div>
          </li>
        ))}
      </ul>
      {link_text && (
        <a className="lp-guides-more" href="/destinations">
          {link_text} →
        </a>
      )}
    </section>
  );
}
