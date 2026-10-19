import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import "../styles/picker.css";
import { SiteFooter, SiteHeader } from "../components/SiteFrame";
import { FlapBoard, boardText, boardTimeline } from "../components/FlapBoard";
import type { BoardRow } from "../components/FlapBoard";
import { DESTINATIONS, MONTHS, countryFlag, findDestination, flightTime, photoProps } from "../destinations";
import type { DestinationCard } from "../destinations";
import { HUBS, hubIcon } from "../hubs";
import {
  BUDGET_CHOICES,
  FROM_AIRPORTS,
  LENGTH_CHOICES,
  MONTH_NAMES,
  NO_ANSWERS,
  PICKER_TYPES,
  QUESTIONS,
  answersQuery,
  answersSummary,
  boardCode,
  draw,
  fromAirport,
  loosen,
  matches,
  PICKED_IDEA,
  pickMeta,
  pickerStay,
  readAlso,
  readAnswers,
  resultHref,
  shuffled,
} from "../picker";
import type { Answers, Question } from "../picker";
import { flightLink } from "../../shared/flights";
import { hotelLink } from "../../shared/hotels";
import { activitiesLink } from "../../shared/activities";
import { PAGES, destinationPath } from "../../shared/seo";
import type { HolidayType } from "../../shared/ideaDetails";
import { api } from "../api";
import { load, save } from "../storage";
import { SIGNED_IN } from "../lastFamily";
import { useMedia } from "../useMedia";

const STEP_MS = 60;

/**
 * The holiday picker at /holiday-picker, for visitors without an account: four questions, a draw on
 * the departures board, then the result at /holiday-picker/<guide>, which nudges them to sign up and
 * save it. `slug` is set on a result page. The answers come from the address once the page is up, so
 * the prerendered page and the first draw in the browser match.
 */
export function HolidayPicker({ slug }: { slug?: string }) {
  const [page, setPage] = useState<{ slug: string | null; query: string }>({ slug: slug ?? null, query: "" });
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [step, setStep] = useState(0);
  const [drawing, setDrawing] = useState<{ winner: DestinationCard; also: DestinationCard[] } | null>(null);

  // Answers in the address: a shared result, or "Change answers" from one. Back and forward move between them.
  useEffect(() => {
    const read = () => {
      const m = location.pathname.match(/^\/holiday-picker\/([a-z0-9-]+)\/?$/);
      const q = new URLSearchParams(location.search);
      setPage({ slug: m && findDestination(m[1]) ? m[1] : null, query: location.search });
      setAnswers(readAnswers(q));
      setDrawing(null);
      if (!m && q.toString()) setStep(QUESTIONS.length - 1);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const winner = page.slug ? findDestination(page.slug) : undefined;
  useEffect(() => {
    document.title = winner ? pickMeta(winner).title : PAGES.picker.title;
  }, [winner]);

  const start = (a: Answers) => {
    const picked = draw(matches(DESTINATIONS, a));
    if (picked) setDrawing(picked);
  };
  const landed = () => {
    if (!drawing) return;
    const href = resultHref(
      drawing.winner.slug,
      answers,
      drawing.also.map((d) => d.slug),
    );
    history.pushState(null, "", href);
    setPage({ slug: drawing.winner.slug, query: href.slice(href.indexOf("?")) });
    setDrawing(null);
    window.scrollTo({ top: 0 });
  };
  const changeAnswers = () => {
    const q = answersQuery(answers).toString().replace(/%2C/g, ",");
    history.pushState(null, "", `/holiday-picker${q ? `?${q}` : ""}`);
    setPage({ slug: null, query: q });
    setStep(0);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="lp lp-home hp">
      <SiteHeader current="picker" exact={!winner} />
      {winner ? (
        <Result key={winner.slug + page.query} d={winner} answers={answers} also={readAlso(new URLSearchParams(page.query), DESTINATIONS, winner.slug)} onAgain={() => start(answers)} onChange={changeAnswers} />
      ) : (
        <Questions answers={answers} setAnswers={setAnswers} step={step} setStep={setStep} onDraw={() => start(answers)} />
      )}
      <SiteFooter />
      {drawing && <Draw winner={drawing.winner} also={drawing.also} answers={answers} onLanded={landed} onClose={() => setDrawing(null)} />}
    </div>
  );
}

/* ---------- The questions ---------- */

const QUESTION_LABEL: Record<Question, string> = { types: "YOU ENJOY", month: "DEPARTS", budget: "BUDGET", length: "FROM & NIGHTS" };

function answerText(q: Question, a: Answers): string {
  if (q === "types") return a.types.length ? a.types.map((t) => PICKER_TYPES.find((x) => x.key === t)!.label).join(", ") : "Anything";
  if (q === "month") return a.month ? MONTH_NAMES[MONTHS.indexOf(a.month)] : "Any time";
  if (q === "budget") return a.budget ? `${BUDGET_CHOICES[a.budget - 1].label} ${BUDGET_CHOICES[a.budget - 1].title}` : "Any budget";
  const length = LENGTH_CHOICES.find((x) => x.key === a.length)?.title ?? "Any length";
  return `${a.from}, ${length.replace(/^A /, "a ").replace(/^About/, "about").replace(/^Two/, "two").replace(/^Any/, "any")}`;
}

function Questions({
  answers,
  setAnswers,
  step,
  setStep,
  onDraw,
}: {
  answers: Answers;
  setAnswers: (a: Answers) => void;
  step: number;
  setStep: (n: number) => void;
  onDraw: () => void;
}) {
  const fitting = useMemo(() => matches(DESTINATIONS, answers), [answers]);
  const card = useRef<HTMLFieldSetElement>(null);
  const q = QUESTIONS[step];
  const last = step === QUESTIONS.length - 1;
  const go = (n: number) => {
    setStep(n);
    // Keep the question in view on phones, where the steps above it take up the screen.
    requestAnimationFrame(() => card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };
  const toggleType = (t: HolidayType) => setAnswers({ ...answers, types: answers.types.includes(t) ? answers.types.filter((x) => x !== t) : [...answers.types, t] });
  const fixes = fitting.length ? [] : loosen(DESTINATIONS, answers);

  return (
    <main>
      <section className="lp-wrap hp-hero">
        <nav aria-label="Breadcrumb" className="hp-crumbs">
          <a href="/">Home</a> › Holiday picker
        </nav>
        <h1>Can't pick a holiday? Let the board decide.</h1>
        <p className="lp-lead">Four quick questions, then we draw a destination at random from our guides. Free, and no account needed.</p>
      </section>

      <section className="lp-wrap hp-quiz" aria-label="Your questions">
        <ol className="hp-stubs" aria-label="Questions">
          {QUESTIONS.map((key, i) => {
            const state = i === step ? "now" : i < step ? "done" : "next";
            return (
              <li key={key} className={`hp-stub ${state}`} aria-current={i === step ? "step" : undefined}>
                <span className="hp-stub-num" aria-hidden>
                  {i < step ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <button type="button" className="hp-stub-body" onClick={() => go(i)} disabled={i === step}>
                  <span className="hp-stub-label">
                    {String(i + 1).padStart(2, "0")} · {QUESTION_LABEL[key]}
                  </span>
                  <strong>{i === step ? "Choosing…" : i < step ? answerText(key, answers) : "Next"}</strong>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="hp-phone-steps">
          <div className="hp-progress">
            <span>
              TICKET {step + 1} / {QUESTIONS.length}
            </span>
            <span className="hp-dots" aria-hidden>
              {QUESTIONS.map((key, i) => (
                <span key={key} className={i <= step ? "on" : ""} />
              ))}
            </span>
          </div>
          {QUESTIONS.slice(0, step).map((key, i) => (
            <div key={key} className="hp-done">
              <span className="hp-done-tick" aria-hidden>
                ✓
              </span>
              <span className="hp-done-text">
                <span className="hp-stub-label">{QUESTION_LABEL[key]}</span>
                <strong>{answerText(key, answers)}</strong>
              </span>
              <button type="button" className="btn ghost small" onClick={() => go(i)}>
                Change
              </button>
            </div>
          ))}
        </div>

        <fieldset className="hp-card" ref={card}>
          <legend className="visually-hidden">{QUESTION_LABEL[q]}</legend>
          <div className="hp-card-head">
            <span className="hp-ticket">
              TICKET {step + 1} / {QUESTIONS.length}
            </span>
            <h2>{q === "types" ? "What do you enjoy?" : q === "month" ? "When do you want to go?" : q === "budget" ? "What's the budget?" : "Flying from, and for how long?"}</h2>
            {q === "types" && <p className="muted">Pick as many as you like, or none for anything.</p>}
          </div>

          {q === "types" && (
            <div className="hp-chips">
              {PICKER_TYPES.map((t) => {
                const on = answers.types.includes(t.key);
                return (
                  <button key={t.key} type="button" className={on ? "hp-chip on" : "hp-chip"} aria-pressed={on} onClick={() => toggleType(t.key)}>
                    <span aria-hidden>{t.icon}</span> {t.label}
                  </button>
                );
              })}
            </div>
          )}

          {q === "month" && (
            <div className="hp-months">
              {MONTHS.map((m, i) => (
                <Choice key={m} name="hp-month" checked={answers.month === m} onChange={() => setAnswers({ ...answers, month: m })}>
                  <strong>{MONTH_NAMES[i].slice(0, 3)}</strong>
                  <span className="visually-hidden">{MONTH_NAMES[i].slice(3)}</span>
                </Choice>
              ))}
              <Choice name="hp-month" checked={answers.month === null} onChange={() => setAnswers({ ...answers, month: null })} wide>
                <strong>Any time</strong>
              </Choice>
            </div>
          )}

          {q === "budget" && (
            <div className="hp-options">
              {BUDGET_CHOICES.map((b) => (
                <Choice key={b.key} name="hp-budget" checked={answers.budget === b.key} onChange={() => setAnswers({ ...answers, budget: b.key })} big>
                  <span className="hp-option-mark">{b.label}</span>
                  <strong>{b.title}</strong>
                  <span className="muted small">{b.hint}</span>
                </Choice>
              ))}
              <Choice name="hp-budget" checked={answers.budget === null} onChange={() => setAnswers({ ...answers, budget: null })} wide>
                <strong>Any budget</strong>
              </Choice>
            </div>
          )}

          {q === "length" && (
            <>
              <label className="hp-from">
                <span className="field-label">Flying from</span>
                <select value={answers.from} onChange={(e) => setAnswers({ ...answers, from: e.target.value })}>
                  {FROM_AIRPORTS.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.name}
                      {a.code !== "LON" ? ` (${a.code})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="hp-options">
                {LENGTH_CHOICES.map((l) => (
                  <Choice key={l.key} name="hp-length" checked={answers.length === l.key} onChange={() => setAnswers({ ...answers, length: l.key })} big>
                    <strong>{l.title}</strong>
                    <span className="muted small">{l.hint}</span>
                  </Choice>
                ))}
                <Choice name="hp-length" checked={answers.length === null} onChange={() => setAnswers({ ...answers, length: null })} wide>
                  <strong>Any length</strong>
                </Choice>
              </div>
            </>
          )}

          {fixes.length > 0 && (
            <div className="hp-none" role="status">
              <p>
                <strong>Nothing fits all of that.</strong> Change one answer to get some places back:
              </p>
              <div className="hp-none-fixes">
                {fixes.map((f) => (
                  <button key={f.question} type="button" className="btn ghost small" onClick={() => setAnswers(f.answers)}>
                    {f.label} ({f.count} {f.count === 1 ? "place" : "places"})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hp-actions">
            <button type="button" className="btn ghost hp-back" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Back">
              <span aria-hidden>←</span> <span className="hp-back-word">Back</span>
            </button>
            <span className="hp-count" aria-live="polite">
              <span className="hp-count-n">{fitting.length}</span> {fitting.length === 1 ? "place fits" : "places fit"}
              <span className="hp-count-sub"> so far</span>
            </span>
            {last ? (
              <button type="button" className="btn hp-next" onClick={onDraw} disabled={!fitting.length}>
                Draw my holiday
              </button>
            ) : (
              <button type="button" className="btn hp-next" onClick={() => go(step + 1)}>
                Next <span className="hp-next-word">question</span>
              </button>
            )}
          </div>
        </fieldset>
      </section>

      <section className="lp-wrap hp-more">
        <div className="hp-more-col">
          <h2>How the draw works</h2>
          <p className="muted">
            Your answers filter our destination guides into a shortlist. A few of them go up on a departures board, then they drop out one by one until a single holiday is boarding.
            Every result gets its own page you can share.
          </p>
          <h3>Ideas by holiday type</h3>
          <div className="hp-hubs">
            {HUBS.filter((h) => h.kind === "type").map((h) => (
              <a key={h.slug} className="hp-hub" href={destinationPath(h.slug)}>
                <span aria-hidden>{hubIcon(h)}</span> {h.name}
              </a>
            ))}
          </div>
        </div>
        <div className="hp-more-col">
          <h2>Questions</h2>
          <details open>
            <summary>Do I need an account?</summary>
            <p className="muted">No. You only sign in if you want to save the result to an ideas list for the family.</p>
          </details>
          <details>
            <summary>Can I share my result?</summary>
            <p className="muted">Yes. Every result has its own link you can send to the family, and they can draw again from it.</p>
          </details>
          <details>
            <summary>Where do the destinations come from?</summary>
            <p className="muted">
              From our <a href="/destinations">destination guides</a>, each tagged by holiday type, the best months to go, trip length and budget.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}

/** A radio button drawn as a card or a month tile. */
function Choice({ name, checked, onChange, children, big = false, wide = false }: { name: string; checked: boolean; onChange: () => void; children: ReactNode; big?: boolean; wide?: boolean }) {
  return (
    <label className={`hp-choice${big ? " big" : ""}${wide ? " wide" : ""}${checked ? " on" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span className="hp-choice-body">{children}</span>
    </label>
  );
}

/* ---------- The draw ---------- */

/** The full-screen draw: the places on the board drop out one by one until the winner is boarding. */
function Draw({ winner, also, answers, onLanded, onClose }: { winner: DestinationCard; also: DestinationCard[]; answers: Answers; onLanded: () => void; onClose: () => void }) {
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const close = useRef<HTMLButtonElement>(null);
  const rows: BoardRow[] = useMemo(() => {
    // The winner sits somewhere among the others, not always first.
    const board = [...also];
    board.splice(Math.floor(Math.random() * (also.length + 1)), 0, winner);
    // The board drops the fewest tickets first. Nobody holds tickets here, so each place gets a
    // shuffled count instead and the losers go to DELAYED in a random order, not top to bottom.
    const order = shuffled(board.map((_, i) => i + 1));
    return board.map((d, i) => ({ id: i + 1, code: boardCode(d), title: d.name, tickets: order[i], win: d === winner }));
  }, [winner, also]);
  const { at, end } = useMemo(() => boardTimeline(rows), [rows]);
  const [tick, setTick] = useState(0);
  const done = tick >= end;

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("hp-locked");
    const t = setInterval(() => {
      setTick((n) => {
        if (n + 1 >= end) clearInterval(t);
        return Math.min(n + 1, end);
      });
    }, STEP_MS);
    return () => {
      clearInterval(t);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("hp-locked");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  useEffect(() => {
    if (!done) return;
    void import("../components/celebrate").then((m) => m.celebrate());
    const t = setTimeout(onLanded, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const out = rows.filter((r) => !r.win && tick >= (at.get(r.id) ?? Infinity)).length;
  const losers = rows.length - 1;
  // Every name on the board fits the same row of flaps, so its length doesn't give the winner away.
  const width = Math.max(...rows.map((r) => boardText(r.title).slice(0, 12).length));
  const short = boardText(winner.name).slice(0, 12);
  const pad = Math.floor((width - short.length) / 2);
  const name = (" ".repeat(pad) + short).padEnd(width);
  const meta = ["DEPARTURES", answers.from, answers.month && MONTH_NAMES[MONTHS.indexOf(answers.month)].toUpperCase(), answers.length && LENGTH_CHOICES.find((l) => l.key === answers.length)!.title.toUpperCase()]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="hp-draw" role="dialog" aria-modal="true" aria-label="The draw">
      <div className="hp-draw-inner">
        <div className="hp-draw-top">
          <span className="lp-brand">
            somewhere<span aria-hidden>🎉</span>
          </span>
          <span className="hp-draw-meta">{meta}</span>
          <button type="button" ref={close} className="hp-draw-close" aria-label="Close the draw" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="hp-draw-word">
          <span className={done ? "hp-draw-status lit" : "hp-draw-status"} role="status">
            {done ? `NOW BOARDING: ${winner.name.toUpperCase()}` : "NOW DRAWING…"}
          </span>
          <BigFlaps text={name} tick={tick} settleAt={end - width} still={still} lit={done} />
        </div>

        <FlapBoard rows={rows} at={at} tick={tick} still={still} meta={`${rows.length} ${rows.length === 1 ? "PLACE" : "PLACES"} ON THE BOARD`} />

        <div className="hp-draw-foot">
          {losers > 0 && (
            <div className="hp-draw-progress">
              <div className="hp-draw-progress-text">
                <span>
                  {out} OF {losers} KNOCKED OUT
                </span>
                <span>{rows.length - out} LEFT</span>
              </div>
              <div className="hp-draw-bar" aria-hidden>
                <div style={{ width: `${Math.round((out / losers) * 100)}%` }} />
              </div>
            </div>
          )}
          {done ? (
            <button type="button" className="btn bright" onClick={onLanded}>
              See your holiday →
            </button>
          ) : (
            <button type="button" className="hp-draw-skip" onClick={() => setTick(end)}>
              Skip to the result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The winner's name in big flaps, scrambling until the board settles, a letter at a time. */
function BigFlaps({ text, tick, settleAt, still, lit }: { text: string; tick: number; settleAt: number; still: boolean; lit: boolean }) {
  return (
    <span className={lit ? "hp-flaps lit" : "hp-flaps"} aria-hidden style={{ "--n": text.length } as CSSProperties}>
      {[...text].map((ch, i) => {
        const settled = still ? lit : tick >= settleAt + i;
        // Blank flaps around a short name still spin while drawing.
        const c = settled ? ch : still ? " " : ALPHA[(tick * 7 + i * 11) % ALPHA.length];
        return (
          <span key={i} className="hp-flap">
            {c === " " ? " " : c}
          </span>
        );
      })}
    </span>
  );
}

/* ---------- The result ---------- */

function Result({ d, answers, also, onAgain, onChange }: { d: DestinationCard; answers: Answers; also: DestinationCard[]; onAgain: () => void; onChange: () => void }) {
  const [signedIn, setSignedIn] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setSignedIn(load(SIGNED_IN, false)), []);

  const from = fromAirport(answers.from);
  const flag = countryFlag(d.country_code);
  const month = answers.month ? MONTHS.indexOf(answers.month) : -1;
  const monthName = month >= 0 ? MONTH_NAMES[month] : "";
  const rating = month >= 0 ? d.months[month] : null;
  const summary = answersSummary(answers);
  const lengthTitle = LENGTH_CHOICES.find((l) => l.key === answers.length)?.title;
  const stay = pickerStay(answers);
  const place = { name: d.name, country: d.country, country_code: d.country_code, lat: d.lat, lon: d.lon };
  const flights = d.to_code && d.to_code !== from.code ? flightLink(from.code, d.to_code, 2, "holiday_picker", { dates: stay }) : null;
  const time = flightTime(from, d);

  const remember = () => saveIdea(d.slug);
  const saveHref = signedIn ? `/#/next/add/${d.slug}` : "/#signin";
  const share = async () => {
    const url = location.href;
    if (typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: `Our random holiday: ${d.name}`, text: `The somewhere🎉 holiday picker drew ${d.name} for us!`, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the address bar has the link.
    }
  };

  return (
    <>
      <div className="hp-band">
        <div className="lp-wrap hp-band-inner">
          <div className="hp-band-word">
            <span className="hp-band-kicker">
              🏆 NOW BOARDING{also.length ? ` · BEAT ${also.length} OTHER ${also.length === 1 ? "PLACE" : "PLACES"}` : ""}
            </span>
            <span className="hp-flaps lit small" aria-hidden style={{ "--n": Math.max(6, boardText(d.name).slice(0, 12).length) } as CSSProperties}>
              {[...boardText(d.name).slice(0, 12)].map((ch, i) => (
                <span key={i} className="hp-flap">
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </span>
          </div>
          <dl className="hp-band-facts">
            <div>
              <dt>ROUTE</dt>
              <dd>
                {from.code} → {d.to_code || boardCode(d)}
              </dd>
            </div>
            <div>
              <dt>DEPARTS</dt>
              <dd>{month >= 0 ? MONTHS[month].toUpperCase() : "ANY"}</dd>
            </div>
            <div>
              <dt>NIGHTS</dt>
              <dd>{d.nights ? d.nights.replace(/\s*to\s*/, "–") : lengthTitle ? lengthTitle.toUpperCase() : "ANY"}</dd>
            </div>
            <div>
              <dt>BUDGET</dt>
              <dd>{d.budget ? BUDGET_CHOICES[d.budget - 1].label : "–"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <main className="lp-wrap hp-result">
        <div className="hp-result-main">
          <div className="hp-result-head">
            <nav aria-label="Breadcrumb" className="hp-crumbs">
              <a href="/">Home</a> › <a href="/holiday-picker">Holiday picker</a> › {d.name}
            </nav>
            <h1>
              Your random holiday: {d.name}
              {flag && <span aria-hidden> {flag}</span>}
            </h1>
            <p className="lp-lead">
              {summary.length ? `Drawn for: ${summary.join(" · ")}, from ${from.name.replace(/^Any London airport$/, "London")}.` : `Drawn at random from every one of our guides.`}
            </p>
          </div>

          <div className="hp-photo">
            {d.image ? (
              <img {...photoProps(d.image, d.image_size, "(max-width: 759px) calc(100vw - 32px), 680px")} alt={d.image_alt} width={d.image_size?.[0]} height={d.image_size?.[1]} />
            ) : (
              <span aria-hidden>{boardCode(d)}</span>
            )}
          </div>

          <section className="hp-why">
            <h2>Why {d.name}{monthName ? ` in ${monthName}` : ""}</h2>
            <p>{d.intro}</p>
            {(rating || time) && (
              <p className="muted">
                {rating && `${monthName} is ${rating.rating === "best" ? "one of the best months to go" : "a good time to go"}${rating.temp !== null ? `, at about ${rating.temp}°C` : ""}. `}
                {time && `${time} from ${from.name.replace(/^Any London airport$/, "London")}.`}
              </p>
            )}
            <a className="hp-guide-link" href={destinationPath(d.slug)}>
              Read the full {d.name} guide →
            </a>
          </section>

          <section className="hp-share" aria-label="Share the result">
            <strong>Share the result with the family</strong>
            <div className="hp-share-buttons">
              <button type="button" className="btn ghost" onClick={() => void share()}>
                {copied ? "Link copied" : "Copy link"}
              </button>
              <button type="button" className="btn ghost" onClick={onAgain}>
                <span aria-hidden>🎟️</span> Draw again
              </button>
              <button type="button" className="link" onClick={onChange}>
                Change answers
              </button>
            </div>
          </section>
        </div>

        <aside className="hp-result-side">
          <section className="hp-nudge" aria-labelledby="hp-nudge">
            <h2 id="hp-nudge">Not ready to book?</h2>
            <p>Save {d.name} to an ideas list, add the places the rest of the family loves, and draw again together when you're ready.</p>
            <ul>
              <li>
                <span aria-hidden>🎟️</span> Everyone spreads points in secret
              </li>
              <li>
                <span aria-hidden>🚫</span> One veto each
              </li>
              <li>
                <span aria-hidden>🏆</span> The draw picks the winner
              </li>
            </ul>
            <a className="btn large block" href={saveHref} onClick={signedIn ? undefined : remember}>
              Save {d.name} to my ideas
            </a>
            <span className="small hp-nudge-note">{signedIn ? "It opens in your Next list, ready to save." : "Free. One email for the whole family."}</span>
          </section>

          <section className="hp-book" aria-labelledby="hp-book">
            <h2 id="hp-book">Book {d.name}</h2>
            {flights && (
              <BookLink href={flights} kind="flights" title={`✈️ Flights ${from.code} to ${d.to_code}`} sub={monthName || "Any time"} />
            )}
            <BookLink
              href={hotelLink(place, "holiday_picker", { dates: stay, guests: 2 })}
              kind="hotels"
              title={`🏨 Hotels in ${d.name}`}
              sub={[monthName, lengthTitle].filter(Boolean).join(" · ") || "Any dates"}
            />
            <BookLink href={activitiesLink(place, "holiday_picker")} kind="things" title={`🎟️ Things to do in ${d.name}`} sub="Tickets and tours" />
            <p className="muted small">
              We may earn a small commission if you book, at no extra cost to you. <a href="/how-we-make-money">How we make money</a>
            </p>
          </section>
        </aside>

        {also.length > 0 && (
          <section className="hp-also" aria-labelledby="hp-also">
            <h2 id="hp-also">Also on the board</h2>
            <ul>
              {also.map((o) => (
                <li key={o.slug}>
                  <a href={destinationPath(o.slug)}>
                    <span aria-hidden>{countryFlag(o.country_code)}</span> <strong>{o.name}</strong>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {!signedIn && (
        <div className="hp-sticky">
          <a className="btn large block" href={saveHref} onClick={remember}>
            Save {d.name} to my ideas
          </a>
          <span className="small">Free. One email for the whole family.</span>
        </div>
      )}
    </>
  );
}

function BookLink({ href, kind, title, sub }: { href: string; kind: "flights" | "hotels" | "things"; title: string; sub: string }) {
  return (
    <a className="hp-book-link" href={href} target="_blank" rel="sponsored noopener" onClick={() => api.bookClick(kind, "holiday_picker")}>
      <span className="hp-book-text">
        <span>{title}</span>
        <span className="muted small">{sub}</span>
      </span>
      <span aria-hidden>↗</span>
    </a>
  );
}

/** Remembers the guide so the signed-in app adds it to their ideas once they've signed up. */
function saveIdea(slug: string) {
  save(PICKED_IDEA, slug);
}
