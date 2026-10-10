import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { IdeaDetails, Place } from "../../shared/types";
import type { Terminal } from "../../shared/terminals";
import { BUDGETS, HOLIDAY_TYPES, TRIP_LENGTHS } from "../../shared/ideaDetails";
import type { HolidayType, TripLength } from "../../shared/ideaDetails";
import { estimateTravel } from "../../shared/travelTime";
import { api } from "../api";
import { useData } from "../data";
import { countryName, flag } from "../countries";
import { PlaceSearch } from "../components/PlaceSearch";
import { StandbyCard } from "../components/StandbyCard";
import { CrossIcon } from "../components/TerminalPicker";
import { ONBOARDING } from "../site";

// The words are edited at /admin (content/site/onboarding.json).
const W = ONBOARDING.welcome;
const A = ONBOARDING.airport;
const I = ONBOARDING.idea;
const D = ONBOARDING.done;

type Step = "welcome" | "airport" | "idea" | "done";

/** Wider than a phone, the steps sit in a two-panel card under a header bar instead of filling the screen. */
const WIDE = "(min-width: 760px)";

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

/**
 * The welcome steps shown the first time someone is in, and again from Settings.
 * The organiser also sets the home airport and gets the family link to send; everyone adds a first idea.
 */
export function Onboarding({ replay = false, onClose }: { replay?: boolean; onClose: () => void }) {
  const { isOwner, home } = useData();
  const steps: Step[] = isOwner ? ["welcome", "airport", "idea"] : ["welcome", "idea"];
  const [step, setStep] = useState<Step>("welcome");
  const [added, setAdded] = useState<Place | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
    top.current?.focus();
  };
  const next = () => go(steps[steps.indexOf(step) + 1] ?? "done");
  const back = () => go(steps[steps.indexOf(step) - 1] ?? "welcome");

  // Reaching the end counts as done, whichever buttons were used to get there.
  useEffect(() => {
    if (step === "done") void api.finishOnboarding().catch(() => {});
  }, [step]);

  const n = steps.indexOf(step);
  const wide = useWide();
  const onBack = n > 0 ? back : undefined;
  const body =
    step === "done" ? (
      <Done added={added} from={home} onClose={onClose} />
    ) : step === "welcome" ? (
      <Welcome isOwner={isOwner} onNext={next} onLeave={replay ? onClose : undefined} />
    ) : step === "airport" ? (
      <Airport onNext={next} onBack={onBack} />
    ) : (
      <FirstIdea onNext={(p) => (setAdded(p), next())} onBack={onBack} />
    );

  if (wide) {
    return (
      <div className="onb onb-wide" ref={top} tabIndex={-1}>
        <header className="onb-head">
          <div className="onb-head-inner">
            <Brand />
            {step !== "done" && (
              <div className="onb-head-steps">
                <span className="mono-label onb-count">
                  STEP {n + 1} OF {steps.length}
                </span>
                <Progress steps={steps} n={n} />
              </div>
            )}
          </div>
        </header>
        <main className="onb-stage">
          <div className="onb-card">{body}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="onb" ref={top} tabIndex={-1}>
      <div className="onb-col">
        {step === "done" ? (
          body
        ) : (
          <>
            <div className="onb-top">
              {n > 0 ? (
                <button type="button" className="onb-back" onClick={back} aria-label="Back">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              ) : (
                <Brand />
              )}
              <span className="mono-label onb-count">
                STEP {n + 1} OF {steps.length}
              </span>
            </div>
            <Progress steps={steps} n={n} />
            {body}
          </>
        )}
      </div>
    </div>
  );
}

function Progress({ steps, n }: { steps: Step[]; n: number }) {
  return (
    <div className="onb-progress" aria-hidden>
      {steps.map((s, i) => (
        <span key={s} className={i <= n ? "on" : undefined} />
      ))}
    </div>
  );
}

/** The wide layout's two panels: the words and fields on the left, the board, pass or card on the right. */
function Split({ left, right, panel = true }: { left: ReactNode; right: ReactNode; panel?: boolean }) {
  return (
    <>
      <div className="onb-left">{left}</div>
      <div className={panel ? "onb-right onb-panel" : "onb-right"}>{right}</div>
    </>
  );
}

/** The wide layout's buttons in one row: Back on the left, the skip link and the main button on the right. */
function Row({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="onb-row">
      {onBack && (
        <button type="button" className="onb-skip" onClick={onBack}>
          Back
        </button>
      )}
      <span className="onb-row-gap" />
      {children}
    </div>
  );
}

function Brand() {
  return (
    <span className="onb-brand">
      somewhere<span aria-hidden>🎉</span>
    </span>
  );
}

function Intro({ eyebrow, heading, children, standby = false, big = false }: { eyebrow: string; heading: string; children: ReactNode; standby?: boolean; big?: boolean }) {
  return (
    <div className="onb-intro">
      <span className={standby ? "mono-label onb-eyebrow standby" : "mono-label onb-eyebrow"}>{eyebrow}</span>
      <h1 className={big ? "big" : undefined}>{heading}</h1>
      <p className="onb-lede">{children}</p>
    </div>
  );
}

function Welcome({ isOwner, onNext, onLeave }: { isOwner: boolean; onNext: () => void; onLeave?: () => void }) {
  const wide = useWide();
  const intro = (
    <Intro eyebrow={W.eyebrow} heading={W.heading} big>
      {W.lead}
    </Intro>
  );
  const board = (
      <section className="onb-board" aria-label={W.board_label}>
        <div className="onb-board-head">
          <span>{W.board_label}</span>
          <span aria-hidden>STATUS</span>
        </div>
        <ol>
          {W.steps.map((h, i) => (
            <li key={h.title}>
              <span className="onb-board-n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong>
                  {h.icon && <span aria-hidden>{h.icon}</span>} {h.title}
                </strong>
                {h.text && <p>{h.text}</p>}
              </div>
              {i === 0 && <span className="onb-board-now">NOW</span>}
            </li>
          ))}
        </ol>
      </section>
  );
  const bonus = (
      <div className="onb-bonus">
        <span className="onb-bonus-icon" aria-hidden>
          🧳
        </span>
        <div>
          <span className="mono-label onb-eyebrow">{W.bonus_label}</span>
          <p>{W.bonus}</p>
        </div>
      </div>
  );
  const note = (
    <p className="onb-note">
      {isOwner ? W.note_organiser : W.note_member}
    </p>
  );
  const start = (
    <button type="button" className="btn onb-primary" onClick={onNext}>
      {W.button}
    </button>
  );
  const leave = onLeave && (
    <button type="button" className="onb-skip" onClick={onLeave}>
      Back to Settings
    </button>
  );

  if (wide) {
    return (
      <Split
        panel={false}
        left={
          <>
            {intro}
            {bonus}
            <span className="onb-fill" />
            {note}
            <div className="onb-row">
              {start}
              {leave}
            </div>
          </>
        }
        right={board}
      />
    );
  }
  return (
    <>
      {intro}
      {board}
      {bonus}
      {note}
      <Actions>
        {start}
        {leave}
      </Actions>
    </>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="onb-actions">{children}</div>;
}

/** The organiser's home airport: a search with a short list of matches, and a boarding-pass strip showing the pick. */
function Airport({ onNext, onBack }: { onNext: () => void; onBack?: () => void }) {
  const wide = useWide();
  const { home, reload } = useData();
  const [picked, setPicked] = useState<Terminal | null>(home);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Terminal[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.terminals("airport", term);
        if (mine === seq.current) {
          // Short enough on a wide screen that the buttons stay in view.
          setResults(r.slice(0, wide ? 3 : 5).map((x) => x.terminal));
          setError(null);
        }
      } catch (e) {
        if (mine === seq.current) setError((e as Error).message);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q, wide]);

  // With nothing searched yet, the current pick shows as the one row, ticked.
  const rows = results.length > 0 ? results : picked && q.trim().length < 2 ? [picked] : [];
  const same = (a: Terminal | null, b: Terminal | null) => !!a && !!b && a.code === b.code && a.name === b.name;

  const save = async () => {
    if (!picked) return;
    if (same(picked, home)) return onNext();
    setSaving(true);
    setError(null);
    try {
      await api.setHomeEnds({ airport: picked });
      await reload(["home_ends"]);
      onNext();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const intro = (
    <Intro eyebrow={A.eyebrow} heading={A.heading}>
      {A.lead}
    </Intro>
  );
  const search = (
    <>
      <label className="onb-field">
        <span className="field-label">{A.label}</span>
        <span className="onb-search">
          <SearchIcon />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) setPicked(results[0]);
              }
            }}
            placeholder={A.placeholder}
            autoComplete="off"
          />
        </span>
      </label>

      {(rows.length > 0 || searching || error || q.trim().length >= 2) && (
        <ul className="onb-results" aria-label="Matching airports">
          {rows.map((t) => {
            const on = same(t, picked);
            return (
              <li key={`${t.code}-${t.name}`}>
                <button type="button" className={on ? "on" : undefined} aria-pressed={on} onClick={() => setPicked(t)}>
                  <span className="onb-code">{t.code}</span>
                  <span className="onb-result-text">
                    <strong>{t.name}</strong>
                    <span>
                      {flag(t.country_code)} {countryName(t.country_code)}
                    </span>
                  </span>
                  {on && (
                    <span className="onb-tick" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {searching && results.length === 0 && <li className="muted">Searching…</li>}
          {!searching && !error && rows.length === 0 && <li className="muted">No matches</li>}
        </ul>
      )}
      {error && <p className="error-text">{error}</p>}
    </>
  );
  const pass = (
      <div className="onb-homebase">
        <span className="onb-homebase-stub" aria-hidden>
          HOME BASE
        </span>
        <div>
          <span className="mono-label">{A.pass_label}</span>
          <div className="onb-route" aria-label={picked ? `Every trip starts from ${picked.name}` : "No airport picked yet"}>
            <span className={picked ? "onb-route-code" : "onb-route-code blank"}>{picked?.code ?? "???"}</span>
            <span className="onb-dash" />
            <span aria-hidden>✈️</span>
            <span className="onb-dash" />
            <span className="onb-route-code blank">???</span>
          </div>
          {wide && (
            <div className="onb-pass-ends">
              <div>
                <span className="mono-label">FROM</span>
                <strong>{picked?.name ?? "Your airport"}</strong>
              </div>
              <div>
                <span className="mono-label">TO</span>
                <strong className="muted">Your next idea</strong>
              </div>
            </div>
          )}
        </div>
      </div>
  );
  const go = (
    <button type="button" className="btn onb-primary" onClick={() => void save()} disabled={!picked || saving}>
      {saving ? "Saving…" : A.button}
    </button>
  );
  const skip = (
    <button type="button" className="onb-skip" onClick={onNext}>
      {A.skip}
    </button>
  );

  if (wide) {
    return (
      <Split
        left={
          <>
            {intro}
            {search}
            <span className="onb-fill" />
            <Row onBack={onBack}>
              {skip}
              {go}
            </Row>
          </>
        }
        right={
          <>
            {pass}
            <p className="onb-panel-note">{A.pass_note}</p>
          </>
        }
      />
    );
  }
  return (
    <>
      {intro}
      {search}
      {pass}
      <Actions>
        {go}
        {skip}
      </Actions>
    </>
  );
}

function SearchIcon() {
  return (
    <svg className="onb-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** The first few holiday types show straight away; the rest wait behind More. */
const FIRST_TYPES: readonly HolidayType[] = ["city", "beach", "nature"];
const SHORT_LENGTH: Record<TripLength, string> = { weekend: "Weekend", week: "A week", "two-weeks": "2 weeks", longer: "3 weeks+" };

/** One place to start the Next list with, and a few details, previewed as its standby card. */
function FirstIdea({ onNext, onBack }: { onNext: (p: Place | null) => void; onBack?: () => void }) {
  const wide = useWide();
  const { me, home, reload } = useData();
  const [place, setPlace] = useState<Place | null>(null);
  const [details, setDetails] = useState<IdeaDetails>({ budget: null, trip_length: null, travel_time: null, holiday_types: [] });
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const places = place ? [place] : [];
  const travel_time = estimateTravel(home, places)?.travel_time ?? null;
  const idea = { ...details, travel_time, title: place?.name ?? "", places, cover_url: null, created_by: me?.id ?? null, depart: null, arrive: null };

  const types = HOLIDAY_TYPES.filter((t) => more || FIRST_TYPES.includes(t.key) || details.holiday_types.includes(t.key));
  const toggle = (k: HolidayType) =>
    setDetails({ ...details, holiday_types: details.holiday_types.includes(k) ? details.holiday_types.filter((t) => t !== k) : [...details.holiday_types, k] });

  const save = async () => {
    if (!place) return;
    setSaving(true);
    setError(null);
    try {
      await api.createIdea({ ...idea, description: null });
      await reload(["ideas"]);
      onNext(place);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const intro = (
    <Intro eyebrow={I.eyebrow} heading={I.heading} standby>
      {I.lead}
    </Intro>
  );
  const fields = (
      <div className="onb-fields">
        <div className="onb-field">
          <span className="field-label" id="onb-place">
            Place
          </span>
          {place ? (
            <div className="onb-picked">
              <span aria-hidden>{flag(place.country_code)}</span>
              <span>
                <strong>{place.name}</strong>, {place.country}
              </span>
              <button type="button" onClick={() => setPlace(null)} aria-label={`Change ${place.name}`}>
                <CrossIcon />
              </button>
            </div>
          ) : (
            <PlaceSearch onAdd={setPlace} placeholder="A city, region or country" icon />
          )}
        </div>

        <fieldset className="onb-set">
          <legend className="field-label">Kind of holiday</legend>
          <div className="onb-chips">
            {types.map((t) => {
              const on = details.holiday_types.includes(t.key);
              return (
                <button type="button" key={t.key} className={on ? "onb-chip on" : "onb-chip"} aria-pressed={on} onClick={() => toggle(t.key)}>
                  <span aria-hidden>{t.icon}</span> {t.label}
                </button>
              );
            })}
            {!more && (
              <button type="button" className="onb-chip more" onClick={() => setMore(true)}>
                More…
              </button>
            )}
          </div>
        </fieldset>

        <Segments
          legend="How long"
          options={TRIP_LENGTHS.map((l) => ({ key: l.key, label: SHORT_LENGTH[l.key], title: l.label }))}
          value={details.trip_length}
          onChange={(k) => setDetails({ ...details, trip_length: k })}
        />
        <Segments
          legend="Budget"
          options={BUDGETS.map((b) => ({ key: b.key, label: b.label, title: b.hint }))}
          value={details.budget}
          onChange={(k) => setDetails({ ...details, budget: k })}
        />
      </div>
  );
  const preview = (
    <div className="onb-preview">
      <span className="mono-label">PREVIEW</span>
      <StandbyCard preview idea={{ ...idea, status: "active" }} />
      {wide && <p className="onb-panel-note">{I.preview_note}</p>}
    </div>
  );
  const errorText = error && <p className="error-text">{error}</p>;
  const add = (
    <button type="button" className="btn onb-primary" onClick={() => void save()} disabled={!place || saving}>
      {saving ? "Saving…" : I.button}
    </button>
  );
  const later = (
    <button type="button" className="onb-skip" onClick={() => onNext(null)}>
      {I.skip}
    </button>
  );

  if (wide) {
    return (
      <Split
        left={
          <>
            {intro}
            {fields}
            <span className="onb-fill" />
            {errorText}
            <Row onBack={onBack}>
              {later}
              {add}
            </Row>
          </>
        }
        right={preview}
      />
    );
  }
  return (
    <>
      {intro}
      {fields}
      {preview}
      {errorText}
      <Actions>
        {add}
        {later}
      </Actions>
    </>
  );
}

/** A row of buttons where one, or none, is picked. Picking the picked one again clears it. */
function Segments<K extends string | number>({ legend, options, value, onChange }: { legend: string; options: { key: K; label: string; title: string }[]; value: K | null; onChange: (k: K | null) => void }) {
  return (
    <fieldset className="onb-set">
      <legend className="field-label">{legend}</legend>
      <div className="onb-segments" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button type="button" key={o.key} title={o.title} className={value === o.key ? "on" : undefined} aria-pressed={value === o.key} onClick={() => onChange(value === o.key ? null : o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** The end: a departures board with the family's standby count, and for the organiser, the family link to send. */
function Done({ added, from, onClose }: { added: Place | null; from: Terminal | null; onClose: () => void }) {
  const wide = useWide();
  const { ideas, isOwner, shareUrl } = useData();
  const standby = ideas.filter((i) => i.status === "active");
  const count = String(Math.min(standby.length, 99)).padStart(2, "0");
  const shown = added ?? standby[0]?.places[0] ?? null;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is on screen to copy by hand.
    }
  };
  const share = async () => {
    if (!shareUrl) return;
    if (typeof navigator.share === "function") {
      await navigator.share({ title: "somewhere🎉", text: "Join our family's somewhere🎉 to add holiday ideas and vote in the draw.", url: shareUrl }).catch(() => {});
    } else {
      await copy();
    }
  };
  const toNext = () => {
    location.hash = "/next";
    onClose();
  };

  const intro = added
    ? `${added.name} is on standby. `
    : standby.length > 0
      ? `Your family has ${standby.length === 1 ? "an idea" : `${standby.length} ideas`} on standby. `
      : "";
  const invite = isOwner && shareUrl;

  const board = (
      <section className="onb-board onb-departures" aria-label={`${standby.length} ${standby.length === 1 ? "idea" : "ideas"} on standby`}>
        <div className="onb-board-head">
          <span>DEPARTURES</span>
          {from?.code && <span>FROM {from.code}</span>}
        </div>
        <div className="onb-flaps" aria-hidden>
          {[...count].map((d, i) => (
            <span key={i} className="onb-flap">
              {d}
            </span>
          ))}
          <span className="onb-flaps-label">{standby.length === 1 ? "IDEA ON STANDBY" : "IDEAS ON STANDBY"}</span>
        </div>
        <div className="onb-board-row" aria-hidden>
          <span>{shown ? `${flag(shown.country_code)} ${shown.name.toUpperCase()}` : "YOUR IDEAS"}</span>
          <span className="onb-board-now">{shown ? "BOARDING SOON" : "OPEN FOR CHECK-IN"}</span>
        </div>
      </section>
  );
  const words = (
      <div className="onb-intro">
        <h1>{D.heading}</h1>
        <p className="onb-lede">
          {intro}
          {invite ? D.organiser_text : D.member_text}
        </p>
      </div>
  );
  const shareButton = (
    <button type="button" className="btn onb-primary" onClick={() => void share()}>
      {D.share_button}
    </button>
  );
  const invitePanel = invite && (
    <section className="onb-invite" aria-labelledby="onb-invite-h">
      {wide && <span className="mono-label onb-eyebrow">{D.invite_label}</span>}
      <h2 id="onb-invite-h">{D.invite_heading}</h2>
      <p className="muted small">{D.invite_text}</p>
      {wide && (
        <label className="field-label" htmlFor="onb-family-link">
          Family link
        </label>
      )}
      <div className="onb-link">
        <input id="onb-family-link" readOnly value={shareUrl.replace(/^https?:\/\//, "")} onFocus={(e) => e.target.select()} aria-label="Your family link" />
        <button type="button" className="btn ghost onb-copy" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {wide && shareButton}
    </section>
  );

  if (wide) {
    const toIdeas = (
      <button type="button" className={invite ? "onb-skip" : "btn onb-primary"} onClick={toNext}>
        {D.ideas_button}
      </button>
    );
    return invite ? (
      <Split
        panel={false}
        left={
          <>
            {board}
            {words}
            <span className="onb-fill" />
            <div className="onb-row">{toIdeas}</div>
          </>
        }
        right={invitePanel}
      />
    ) : (
      <Split
        panel={false}
        left={
          <>
            {words}
            <span className="onb-fill" />
            <div className="onb-row">{toIdeas}</div>
          </>
        }
        right={board}
      />
    );
  }

  return (
    <>
      <div className="onb-top">
        <Brand />
      </div>
      {board}
      {words}
      {invitePanel}
      <Actions>
        {invite ? (
          <>
            <button type="button" className="btn onb-primary" onClick={() => void share()}>
              {D.share_button}
            </button>
            <button type="button" className="onb-skip" onClick={toNext}>
              {D.ideas_button}
            </button>
          </>
        ) : (
          <button type="button" className="btn onb-primary" onClick={toNext}>
            {D.ideas_button}
          </button>
        )}
      </Actions>
    </>
  );
}
