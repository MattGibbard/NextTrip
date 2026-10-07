import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Idea, Round } from "../../shared/types";
import type { Terminal } from "../../shared/terminals";
import { countedAllocations, ticketRanges, vetoesIgnored } from "../../shared/draw";
import { MODES, ideaMode, placeCode, ticketEnds } from "../../shared/travelMode";
import { api } from "../api";
import { useData } from "../data";
import { flag } from "../countries";
import { load, save } from "../storage";
import { listNames, plural } from "../format";
import { TripForm } from "./TripForm";
import { IdeaDetailsLine } from "../components/IdeaDetails";
import { celebrate } from "../components/celebrate";
import { SwipeDeck } from "../components/SwipeDeck";
import { FlapBoard, boardTimeline, useMedia } from "../components/FlapBoard";
import type { BoardRow } from "../components/FlapBoard";
import { RoundFilterFields, RoundFilterLine } from "../components/RoundFilters";
import { NO_FILTERS, hasFilters, matchesFilters } from "../../shared/roundFilters";
import type { RoundFilters } from "../../shared/roundFilters";
import type { TripDraft } from "./TripForm";

const dayMonth = (sql: string, year = false) =>
  new Date(sql.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });

const flagsOf = (i: Pick<Idea, "places">) => [...new Set(i.places.map((p) => p.country_code))].map(flag).join(" ");

/** The three-letter code an idea shows on the board: where a flight lands, or where a road trip or train sets off. */
function ideaCode(i: Pick<Idea, "places" | "holiday_types" | "depart" | "arrive">, home: Terminal | null) {
  const mode = ideaMode(i.holiday_types);
  const ends = ticketEnds(mode, i, home);
  if (ends) return mode === "flight" || mode === "cruise" ? ends.to.code : ends.from.code;
  return i.places[0] ? placeCode(i.places[0].name) : "···";
}

function DrawHead({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="draw-head">
      <div className="draw-head-text">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display">{title}</h1>
        {sub}
      </div>
      {children}
    </div>
  );
}

export function DrawView() {
  const { rounds, reload } = useData();
  const open = rounds.find((r) => r.status === "open");
  const drawn = rounds.filter((r) => r.status === "drawn");
  const [seen, setSeen] = useState<number[]>(() => load("seenRounds", []));
  const [revealing, setRevealing] = useState<Round | null>(null);

  // Keep the lock-in status fresh while a round is open, so everyone else's progress shows up.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void reload(), 8000);
    return () => clearInterval(t);
  }, [open, reload]);

  const markSeen = (id: number) => {
    const next = [...new Set([...seen, id])];
    setSeen(next);
    save("seenRounds", next);
  };

  const unseen = drawn.find((r) => !seen.includes(r.id));

  return (
    <section className="draw-page">
      {revealing ? (
        <Reveal round={revealing} onDone={() => markSeen(revealing.id)} onClose={() => setRevealing(null)} />
      ) : unseen ? (
        <>
          <DrawHead eyebrow="Now boarding · The draw" title="Holiday draw" />
          <div className="draw-ready-panel">
            <div className="eyebrow">Final call · {unseen.name}</div>
            <h2 className="display-2">🎟️ {unseen.name} has been drawn!</h2>
            <p className="muted">Ready to find out where you're going?</p>
            <button className="btn bright large glow" onClick={() => setRevealing(unseen)}>
              Reveal the winner
            </button>
          </div>
        </>
      ) : open ? (
        <OpenRound round={open} onDrawn={(r) => setRevealing(r)} />
      ) : (
        <StartRound lastPoints={drawn[0]?.points_per_person ?? 10} roundNo={rounds.length + 1} />
      )}

      {drawn.length > 0 && !revealing && (
        <div className="history">
          <h2>Past draws</h2>
          {drawn.map((r) => (
            <HistoryRow key={r.id} round={r} hidden={!seen.includes(r.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function StartRound({ lastPoints, roundNo }: { lastPoints: number; roundNo: number }) {
  const { ideas, reload } = useData();
  const [points, setPoints] = useState(lastPoints);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RoundFilters>(NO_FILTERS);
  const [swipe, setSwipe] = useState(true);
  const pool = ideas.filter((i) => i.status === "active");
  const matching = pool.filter((i) => matchesFilters(i, filters));
  const filtered = hasFilters(filters);
  const bump = (d: number) => setPoints((p) => Math.max(1, Math.min(100, p + d)));

  const start = async () => {
    try {
      await api.createRound({ name: name.trim() || undefined, points_per_person: points, filters, swipe });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <DrawHead
        eyebrow="Now boarding · The draw"
        title="Holiday draw"
        sub={<p className="draw-lead">Everyone spreads their points in secret, gets one veto, and the draw picks where you go.</p>}
      />
      {pool.length < 2 ? (
        <div className="panel">
          <p>
            Add at least two ideas first (there {pool.length === 1 ? "is 1" : `are ${pool.length}`} now). <a href="#/next">Go to Next</a>
          </p>
        </div>
      ) : (
        <div className="draw-start">
          <section className="ticket-office" aria-labelledby="new-round">
            <div className="office-strip mono-label">
              <span>Ticket office</span>
              <span>Round {String(roundNo).padStart(2, "0")}</span>
            </div>
            <div className="office-body">
              <div>
                <h2 id="new-round">Start a new round</h2>
                <p className="muted small">Name it, pick how many points you each get, then choose which ideas are in.</p>
              </div>
              <div className="office-fields">
                <label className="field">
                  Round name
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2027" />
                </label>
                <div className="field">
                  <span id="points-label">Points each</span>
                  <div className="count-stepper" role="group" aria-labelledby="points-label">
                    <button type="button" aria-label="Fewer points" onClick={() => bump(-1)} disabled={points <= 1}>
                      −
                    </button>
                    <span className="value" aria-live="polite">
                      {points}
                    </span>
                    <button type="button" aria-label="More points" onClick={() => bump(1)} disabled={points >= 100}>
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="ideas-in">
                <div className="ideas-in-head">
                  <h3>Which ideas are in?</h3>
                  <span className="muted small">Leave it all on any to include everything.</span>
                </div>
                <RoundFilterFields value={filters} onChange={setFilters} />
                {filtered && (
                  <p className={`small ${matching.length < 2 ? "error-text" : "muted"}`}>
                    {matching.length} of {plural(pool.length, "idea")} match
                    {matching.length < 2 ? ". You need at least 2 to start a round." : "."}{" "}
                    <button className="link" onClick={() => setFilters(NO_FILTERS)}>
                      Clear filters
                    </button>
                  </p>
                )}
              </div>
              <label className="check-card">
                <input type="checkbox" checked={swipe} onChange={(e) => setSwipe(e.target.checked)} />
                <span>
                  <strong>Swipe to shortlist first</strong>
                  <span className="muted small">You each swipe yes or no on every idea. Only the ones everyone likes go into the draw.</span>
                </span>
              </label>
              {error && <p className="error-text">{error}</p>}
              <button className="btn bright large" onClick={start} disabled={matching.length < 2}>
                🎟️ Start round with {plural(points, "point")} each
              </button>
            </div>
          </section>
          <aside className="draw-aside">
            <StandbyBoard pool={pool} matching={matching} />
            <HowItWorks swipe={swipe} />
          </aside>
        </div>
      )}
    </>
  );
}

/** The ideas a new round would include, as a departures board. */
function StandbyBoard({ pool, matching }: { pool: Idea[]; matching: Idea[] }) {
  const { home } = useData();
  const isIn = new Set(matching.map((i) => i.id));
  const n = matching.length;
  return (
    <section className="standby-board" aria-labelledby="standby-title">
      <div className="sb-head">
        <h2 id="standby-title" className="mono-label">
          On standby
        </h2>
        <div className="sb-count" role="img" aria-label={`${plural(n, "idea")} in`}>
          {String(n)
            .split("")
            .map((d, k) => (
              <span key={k} className="sb-digit">
                {d}
              </span>
            ))}
        </div>
      </div>
      <ul className="sb-list">
        {pool.map((i) => (
          <li key={i.id} className={isIn.has(i.id) ? "" : "out"}>
            <span className="sb-code">{ideaCode(i, home)}</span>
            <span className="ellipsis">
              {flagsOf(i)} {i.title}
            </span>
            <span className="sb-state">{isIn.has(i.id) ? "IN" : "OUT"}</span>
          </li>
        ))}
      </ul>
      <p className="sb-note">
        {n === pool.length ? `All ${plural(n, "idea")} are in this round.` : `${n} of ${plural(pool.length, "idea")} are in this round.`} Filters take ideas off the board.
      </p>
    </section>
  );
}

function HowItWorks({ swipe }: { swipe: boolean }) {
  const steps = [
    ...(swipe ? [{ title: "Swipe", body: "You each swipe yes or no. Ideas everyone likes go through." }] : []),
    { title: "Spend your points", body: "Points stay secret until everyone locks in. You each get one veto." },
    { title: "The draw", body: "Every point is a ticket. One is drawn at random and the departures board counts down to it." },
  ];
  return (
    <section className="how-it-works" aria-labelledby="how">
      <h2 id="how">How the draw works</h2>
      <ol>
        {steps.map((s, k) => (
          <li key={s.title}>
            <span className="how-num">{String(k + 1).padStart(2, "0")}</span>
            <span>
              <strong>{s.title}</strong>
              <span className="muted small">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function OpenRound({ round, onDrawn }: { round: Round; onDrawn: (r: Round) => void }) {
  const { people, me, reload, isOwner, ideas } = useData();
  const iLocked = me ? round.locked.includes(me.id) : false;
  const everyone = people.every((p) => round.locked.includes(p.id));
  const shortlisting = round.swipe && !round.shortlist;
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onStandby = round.shortlist
    ? round.shortlist.ids.length
    : ideas.filter((i) => i.status === "active" && matchesFilters(i, round.filters)).length;

  const draw = async () => {
    setDrawing(true);
    try {
      const result = await api.draw(round.id);
      onDrawn(result);
      await reload();
    } catch (e) {
      setError((e as Error).message);
      setDrawing(false);
    }
  };

  const cancel = async () => {
    if (!confirm(`Cancel ${round.name}? Everyone's points for it will be cleared.`)) return;
    await api.deleteRound(round.id);
    await reload();
  };

  return (
    <>
      <DrawHead
        eyebrow="Now boarding · The draw"
        title={round.name}
        sub={
          <>
            <p className="draw-lead small-lead">
              {plural(round.points_per_person, "point")} each · {plural(onStandby, "idea")} on standby · started {dayMonth(round.created_at)}
            </p>
            <RoundFilterLine filters={round.filters} />
          </>
        }
      >
        <div className="crew">
          {people.map((p) => {
            const locked = round.locked.includes(p.id);
            const swiping = round.swiping.includes(p.id);
            const done = shortlisting ? !swiping : locked;
            return (
              <div key={p.id} className="crew-chip">
                <span className="avatar" style={{ background: p.color }}>
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="crew-text">
                  <span className="crew-name">
                    {p.name}
                    {p.id === me?.id ? " (you)" : ""}
                  </span>
                  <span className={`mono-label crew-state ${done ? "on" : ""}`}>
                    {shortlisting ? (swiping ? "Swiping…" : "Done swiping ✓") : locked ? "Locked in ✓" : "Choosing…"}
                  </span>
                </span>
              </div>
            );
          })}
          {isOwner && (
            <button className="link danger" onClick={cancel}>
              Cancel round
            </button>
          )}
        </div>
      </DrawHead>

      {shortlisting ? (
        me && (
          <div className="panel">
            <SwipeDeck key={round.id} round={round} />
          </div>
        )
      ) : (
        <ShortlistNote round={round} />
      )}

      {shortlisting ? null : everyone ? (
        <div className="draw-ready-panel">
          <div className="eyebrow">Final call · {round.name}</div>
          <h2 className="display-2">Everyone's locked in</h2>
          <p className="muted">Time to find out where you're going. There's one draw and no re-rolls.</p>
          {error && <p className="error-text">{error}</p>}
          <button className="btn bright large glow" onClick={draw} disabled={drawing}>
            {drawing ? "Drawing…" : "🎟️ Draw the winner"}
          </button>
          {iLocked && (
            <button className="link" onClick={() => void api.unlock(round.id).then(reload)}>
              Change my points
            </button>
          )}
        </div>
      ) : me && iLocked ? (
        <MyLockedPoints round={round} />
      ) : me ? (
        <Allocator key={round.id} round={round} />
      ) : null}
    </>
  );
}

function ShortlistNote({ round }: { round: Round }) {
  if (!round.shortlist) return null;
  const n = round.shortlist.ids.length;
  const text = {
    both: `Everyone liked ${plural(n, "idea")}, so they're the shortlist.`,
    either: `Not enough ideas got a yes from everyone, so the shortlist is the ${plural(n, "idea")} someone liked.`,
    all: `Hardly anything got a yes, so all ${plural(n, "idea")} are in.`,
  }[round.shortlist.rule];
  return <p className="banner">💞 {text}</p>;
}

function MyLockedPoints({ round }: { round: Round }) {
  const { ideas, reload, people, me } = useData();
  const waitingOn = people.filter((p) => !round.locked.includes(p.id)).map((p) => p.name);
  const myVeto = round.vetoes.find((v) => v.person_id === me?.id);
  const titleOf = (id: number) => ideas.find((i) => i.id === id)?.title ?? "Idea";
  return (
    <section className="points-bar locked" aria-label="Your points">
      <div className="pb-left">
        <div className="pb-count">
          <strong>🔒</strong> You're locked in
        </div>
        <span className="muted small">
          Waiting on <strong>{listNames(waitingOn)}</strong>. Your points stay hidden until the draw.
        </span>
        <ul className="pb-picks">
          {round.allocations
            .filter((a) => a.person_id === me?.id)
            .map((a) => (
              <li key={a.idea_id} className="pill">
                {titleOf(a.idea_id)} · {a.points}
              </li>
            ))}
          {myVeto && <li className="pill veto">🚫 {titleOf(myVeto.idea_id)}</li>}
        </ul>
      </div>
      <button className="btn ghost" onClick={() => void api.unlock(round.id).then(reload)}>
        Change my points
      </button>
    </section>
  );
}

function Allocator({ round }: { round: Round }) {
  const { ideas, me, reload } = useData();
  const myVeto = round.vetoes.find((v) => v.person_id === me?.id)?.idea_id;
  const vetoed = useMemo(() => new Set(round.vetoes.map((v) => v.idea_id)), [round.vetoes]);
  // Every idea in the round, your vetoed one included so it can be undone.
  const inRound = useMemo(
    () =>
      ideas.filter(
        (i) => i.status === "active" && (round.shortlist ? round.shortlist.ids.includes(i.id) : matchesFilters(i, round.filters)),
      ),
    [ideas, round.shortlist, round.filters],
  );
  const pool = useMemo(() => inRound.filter((i) => !vetoed.has(i.id)), [inRound, vetoed]);
  const canVeto = myVeto === undefined && pool.length > 1;
  const [points, setPoints] = useState<Record<number, number>>(() =>
    Object.fromEntries(round.allocations.filter((a) => a.person_id === me?.id).map((a) => [a.idea_id, a.points])),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<unknown> | null>(null);
  const dirty = useRef(false);

  const live = pool.map((i) => ({ idea_id: i.id, points: points[i.id] ?? 0 }));
  const spent = live.reduce((n, a) => n + a.points, 0);
  const total = round.points_per_person;
  const left = total - spent;

  // Save shortly after the last change, so every device sees a consistent picture.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      setSaveState("saving");
      const p = api
        .saveAllocations(round.id, live.filter((a) => a.points > 0))
        .then(() => setSaveState("saved"))
        .catch((e: Error) => {
          setSaveState("error");
          setError(e.message);
        });
      pending.current = p;
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  const change = (id: number, delta: number) => {
    const current = points[id] ?? 0;
    const next = Math.max(0, Math.min(current + delta, current + left));
    if (next === current) return;
    dirty.current = true;
    setError(null);
    setPoints({ ...points, [id]: next });
  };

  const veto = async (idea: Idea) => {
    const msg = `Use your one veto on "${idea.title}"? Any points you have on it come back to you. It stays secret until the results, and points anyone else puts on it won't count in the draw.`;
    if (!confirm(msg)) return;
    try {
      await api.veto(round.id, idea.id);
      setPoints({ ...points, [idea.id]: 0 });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const undoVeto = async () => {
    try {
      await api.unveto(round.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const lock = async () => {
    try {
      await api.saveAllocations(round.id, live.filter((a) => a.points > 0));
      await api.lock(round.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const vetoTitle = inRound.find((i) => i.id === myVeto)?.title;
  const vetoText = `🚫 ${vetoTitle ? `Veto used on ${vetoTitle}` : canVeto ? "1 secret veto left" : "No veto this round"}`;
  const note = `${me?.name}, your points are hidden from everyone until the draw.`;

  return (
    <>
      <section className="points-bar" aria-label="Your points">
        <div className="pb-left">
          <div className="pb-count">
            <strong>{left}</strong> of {plural(total, "point")} left
            <span className="save-state">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
          </div>
          {total <= 30 ? (
            <div className="pb-pips" aria-hidden>
              {Array.from({ length: total }, (_, k) => (
                <span key={k} className={k < spent ? "on" : ""} />
              ))}
            </div>
          ) : (
            <div className="pb-meter" aria-hidden>
              <span style={{ width: `${(spent / total) * 100}%` }} />
            </div>
          )}
          <span className="muted small desktop-only">{note}</span>
        </div>
        <div className="pb-right">
          <span className="veto-pill desktop-only">{vetoText}</span>
          <button className={`btn bright ${left === 0 ? "glow" : ""}`} disabled={left !== 0} onClick={lock}>
            {left === 0 ? "🔒 Lock in my points" : `Spend ${plural(left, "more point")} to lock in`}
          </button>
        </div>
      </section>
      <div className="mobile-only pb-note">
        <span className="veto-pill">{vetoText}</span>
        <p className="muted small">{note}</p>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="alloc-grid">
        {inRound.map((i) => (
          <AllocCard
            key={i.id}
            idea={i}
            points={vetoed.has(i.id) ? 0 : (points[i.id] ?? 0)}
            canAdd={left > 0}
            vetoed={vetoed.has(i.id)}
            onChange={(d) => change(i.id, d)}
            onVeto={canVeto ? () => veto(i) : undefined}
            onUndoVeto={i.id === myVeto ? undoVeto : undefined}
          />
        ))}
      </div>
    </>
  );
}

function AllocCard({
  idea,
  points,
  canAdd,
  vetoed,
  onChange,
  onVeto,
  onUndoVeto,
}: {
  idea: Idea;
  points: number;
  canAdd: boolean;
  vetoed: boolean;
  onChange: (delta: number) => void;
  onVeto?: () => void;
  onUndoVeto?: () => void;
}) {
  const { personName, home } = useData();
  const mode = MODES[ideaMode(idea.holiday_types)];
  return (
    <article className={`alloc-card ${points > 0 ? "has" : ""} ${vetoed ? "vetoed" : ""}`}>
      <div className="ac-body">
        <div className="ac-top mono-label">
          <span className="standby-ink">
            Standby · {mode.icon} {ideaCode(idea, home)}
          </span>
          <span className="muted ellipsis">Added by {personName(idea.created_by)}</span>
        </div>
        <h3 className="ac-title">
          {flagsOf(idea)} {idea.title}
        </h3>
        <p className="muted small">{idea.places.map((p) => p.name).join(" → ") || "No places yet"}</p>
        <IdeaDetailsLine idea={idea} />
      </div>
      <div className="perf" aria-hidden />
      <div className="ac-foot">
        {vetoed ? (
          onUndoVeto && (
            <button className="ac-veto undo" onClick={onUndoVeto}>
              ↩ Undo veto
            </button>
          )
        ) : (
          <button className="ac-veto" onClick={onVeto} disabled={!onVeto}>
            🚫 Veto
          </button>
        )}
        <div className="ac-tickets">
          <span className="mono-label muted">Tickets</span>
          <div className="stepper">
            <button onClick={() => onChange(-1)} disabled={vetoed || points === 0} aria-label={`Take a point off ${idea.title}`}>
              −
            </button>
            <span className="value">{points}</span>
            <button onClick={() => onChange(1)} disabled={vetoed || !canAdd} aria-label={`Add a point to ${idea.title}`}>
              +
            </button>
          </div>
        </div>
      </div>
      {vetoed && (
        <span className="veto-stamp" aria-label="Vetoed">
          VETOED
        </span>
      )}
    </article>
  );
}

/** The ticket layout the server drew from: points on vetoed ideas don't count. */
function drawnRanges(round: Round) {
  return ticketRanges(countedAllocations(round.allocations, round.vetoes.map((v) => v.idea_id)));
}

/** Everyone who took part in a round, even if they've since left the family. */
function useRoundPeople(round: Round) {
  const { allPeople } = useData();
  return allPeople.filter((p) => round.locked.includes(p.id) || round.allocations.some((a) => a.person_id === p.id));
}

const STEP_MS = 60;

/** The departures board counts down to the ticket the server already drew, then the breakdown. */
function Reveal({ round, onDone, onClose }: { round: Round; onDone: () => void; onClose: () => void }) {
  const { ideas, home } = useData();
  const people = useRoundPeople(round);
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const ranges = useMemo(() => drawnRanges(round), [round]);
  const total = ranges.reduce((n, r) => n + r.tickets, 0);
  const titleOf = (id: number) => round.ideas.find((i) => i.id === id)?.title ?? "Idea";
  const rows: BoardRow[] = useMemo(
    () =>
      ranges.map((r) => {
        const idea = ideas.find((i) => i.id === r.idea_id);
        return {
          id: r.idea_id,
          title: titleOf(r.idea_id),
          code: idea ? ideaCode(idea, home) : placeCode(titleOf(r.idea_id)),
          tickets: r.tickets,
          win: r.idea_id === round.winner_idea_id,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranges, ideas, home],
  );
  const { at, end } = useMemo(() => boardTimeline(rows), [rows]);
  const [run, setRun] = useState(0);
  const [tick, setTick] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const landed = useRef(false);
  const done = tick >= end;

  useEffect(() => {
    setTick(0);
    const t = setInterval(() => {
      setTick((n) => {
        if (n + 1 >= end) clearInterval(t);
        return Math.min(n + 1, end);
      });
    }, STEP_MS);
    return () => clearInterval(t);
  }, [run, end]);

  useEffect(() => {
    if (done && !landed.current) {
      landed.current = true;
      celebrate();
      onDone();
    }
  }, [done, onDone]);

  const winnerId = round.winner_idea_id!;
  const winner = titleOf(winnerId);
  const onTime = rows.filter((r) => tick < (at.get(r.id) ?? Infinity)).length;
  const holders = people
    .map((p) => ({ p, n: round.allocations.find((a) => a.person_id === p.id && a.idea_id === winnerId)?.points ?? 0 }))
    .filter((h) => h.n > 0);
  const winTickets = ranges.find((r) => r.idea_id === winnerId)?.tickets ?? 0;
  let sub = `${plural(total, "ticket")} on the board. Every point you spent is one ticket.`;
  if (done) {
    sub = `Ticket ${round.winning_ticket} of ${total}. `;
    sub +=
      holders.length === 1
        ? `${holders[0].p.name} held ${winTickets === 1 ? "the only" : `all ${winTickets}`} ${winner} ticket${winTickets === 1 ? "" : "s"}.`
        : `${winner} had ${plural(winTickets, "ticket")} from ${listNames(holders.map((h) => h.p.name))}.`;
  } else if (onTime < rows.length) {
    sub = onTime === 2 ? "Last two on time. Final call…" : onTime === 1 ? "One left on time…" : `${onTime} still on time.`;
  }
  const drawnAt = round.drawn_at ? new Date(round.drawn_at.replace(" ", "T") + "Z").toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  const planIdea = ideas.find((i) => i.id === winnerId);

  return (
    <div className="reveal">
      <DrawHead
        eyebrow={`The draw · ${round.name}`}
        title={done ? `🎉 You're going to ${winner}!` : `Final call for ${round.name}…`}
        sub={
          <p className="draw-lead" role="status" aria-live="polite">
            {sub}
          </p>
        }
      />
      <FlapBoard rows={rows} at={at} tick={tick} still={still} meta={[round.name.toUpperCase(), plural(total, "TICKET"), drawnAt].filter(Boolean).join(" · ")} />

      <section className="odds-card" aria-labelledby="odds">
        <div className="odds-head">
          <h2 id="odds">Tickets and odds</h2>
          <span className="odds-legend">
            {people.map((p) => (
              <span key={p.id}>
                <span className="dot" style={{ background: p.color }} /> {p.name}
              </span>
            ))}
          </span>
        </div>
        <div className="table-wrap">
          <table className="odds-table">
            <thead>
              <tr>
                <th className="mono-label">Destination</th>
                <th className="mono-label">Tickets</th>
                <th className="mono-label num">Odds</th>
              </tr>
            </thead>
            <tbody>
              {[...rows]
                .sort((a, b) => b.tickets - a.tickets)
                .map((r) => {
                  const out = !r.win && tick >= (at.get(r.id) ?? Infinity);
                  const idea = ideas.find((i) => i.id === r.id);
                  const pips = people.flatMap((p) => {
                    const n = round.allocations.find((a) => a.person_id === p.id && a.idea_id === r.id)?.points ?? 0;
                    return Array.from({ length: n }, () => p.color);
                  });
                  return (
                    <tr key={r.id} className={`${out ? "out" : ""} ${done && r.win ? "winner" : ""}`}>
                      <td>
                        {done && r.win && "🏆 "}
                        {idea ? `${flagsOf(idea)} ` : ""}
                        {r.title}
                      </td>
                      <td>
                        <span className="odds-tickets">
                          {pips.length <= 16 ? (
                            <span className="odds-pips" aria-hidden>
                              {pips.map((c, k) => (
                                <span key={k} style={{ background: c }} />
                              ))}
                            </span>
                          ) : (
                            <span className="odds-bar" aria-hidden>
                              {people.map((p) => {
                                const n = round.allocations.find((a) => a.person_id === p.id && a.idea_id === r.id)?.points ?? 0;
                                return n ? <span key={p.id} style={{ background: p.color, flex: n }} /> : null;
                              })}
                            </span>
                          )}
                          <span className="muted small">{r.tickets}</span>
                        </span>
                      </td>
                      <td className="num">{Math.round((r.tickets / total) * 100)}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {done && showBreakdown && (
        <section className="odds-card" aria-labelledby="fell">
          <h2 id="fell">How the tickets fell</h2>
          <Breakdown round={round} />
        </section>
      )}

      <div className="reveal-actions">
        {done ? (
          <>
            <button className="btn ghost-link" onClick={() => setRun((n) => n + 1)}>
              ↻ Replay
            </button>
            {!showBreakdown && (
              <button className="btn ghost" onClick={() => setShowBreakdown(true)}>
                See how the tickets fell
              </button>
            )}
            <button className="btn ghost" onClick={onClose}>
              Done
            </button>
            {planIdea && (
              <a className="btn bright" href={`#/next/${planIdea.id}`}>
                Start planning
              </a>
            )}
          </>
        ) : (
          <button className="btn bright large" disabled>
            Drawing…
          </button>
        )}
      </div>
    </div>
  );
}

function Breakdown({ round }: { round: Round }) {
  const { allPeople } = useData();
  const people = useRoundPeople(round);
  const counted = drawnRanges(round);
  const total = counted.reduce((n, r) => n + r.tickets, 0);
  const ignored = vetoesIgnored(round.allocations, round.vetoes.map((v) => v.idea_id));
  const vetoOf = (ideaId: number) => (ignored ? undefined : round.vetoes.find((v) => v.idea_id === ideaId));
  // Every idea that got points, including vetoed ones, so you can see what each veto knocked out.
  const rows = ticketRanges(round.allocations)
    .map((r) => ({ idea_id: r.idea_id, tickets: counted.find((c) => c.idea_id === r.idea_id)?.tickets ?? 0 }))
    .sort((a, b) => b.tickets - a.tickets);
  const vetoedWithoutPoints = round.vetoes.filter((v) => !rows.some((r) => r.idea_id === v.idea_id));
  const titleOf = (id: number) => round.ideas.find((i) => i.id === id)?.title ?? "an idea";
  const nameOf = (id: number) => allPeople.find((p) => p.id === id)?.name ?? "someone";
  return (
    <div className="table-wrap">
      <table className="breakdown">
        <thead>
          <tr>
            <th className="mono-label">Idea</th>
            {people.map((p) => (
              <th key={p.id} className="mono-label num">
                <span className="dot" style={{ background: p.color }} /> {p.name}
              </th>
            ))}
            <th className="mono-label num">Odds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const veto = vetoOf(r.idea_id);
            return (
              <tr key={r.idea_id} className={r.idea_id === round.winner_idea_id ? "winner" : veto ? "vetoed" : ""}>
                <td>
                  {r.idea_id === round.winner_idea_id && "🏆 "}
                  {veto ? <s>{titleOf(r.idea_id)}</s> : titleOf(r.idea_id)}
                  {veto && <div className="muted small">🚫 Vetoed by {nameOf(veto.person_id)}</div>}
                </td>
                {people.map((p) => (
                  <td key={p.id} className="num">
                    {round.allocations.find((a) => a.person_id === p.id && a.idea_id === r.idea_id)?.points ?? "–"}
                  </td>
                ))}
                <td className="num">{r.tickets ? `${Math.round((r.tickets / total) * 100)}%` : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {vetoedWithoutPoints.length > 0 && (
        <p className="muted small">
          🚫 Also vetoed: {vetoedWithoutPoints.map((v) => `${titleOf(v.idea_id)} (${nameOf(v.person_id)})`).join(", ")}
        </p>
      )}
      {ignored && <p className="muted small">The vetoes knocked out every ticket, so they were ignored for this draw.</p>}
    </div>
  );
}

function HistoryRow({ round, hidden }: { round: Round; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const { ideas, reload, isOwner, home } = useData();
  const remove = async () => {
    const back = winnerIdea?.status === "won" ? ` ${winnerIdea.title} goes back into the pool.` : "";
    if (!confirm(`Delete ${round.name} and everyone's points for it?${back}`)) return;
    await api.deleteRound(round.id);
    await reload();
  };
  const winner = round.ideas.find((i) => i.id === round.winner_idea_id);
  const winnerIdea: Idea | undefined = ideas.find((i) => i.id === round.winner_idea_id);
  const date = round.drawn_at ? dayMonth(round.drawn_at, true) : "";
  const modeKey = winnerIdea && !hidden ? ideaMode(winnerIdea.holiday_types) : "flight";
  const mode = MODES[modeKey];
  const ends = winnerIdea && !hidden ? ticketEnds(modeKey, winnerIdea, home) : null;

  return (
    <div className={`history-row mode-${modeKey} ${hidden ? "sealed" : ""}`}>
      <button className="history-head" onClick={() => !hidden && setOpen(!open)} disabled={hidden} aria-expanded={hidden ? undefined : open}>
        <span className="hs-stub" aria-hidden>
          {hidden ? "🎟️" : mode.icon}
        </span>
        <span className="hs-body">
          <span className="hs-text">
            <span className="mono-label mode-ink">
              {hidden ? "🎟️" : mode.icon} {ends ? `${ends.from.code} → ${ends.to.code} · ` : ""}
              {round.name}
            </span>
            <span className="hs-title">{hidden ? "Not revealed yet" : `${winnerIdea ? flagsOf(winnerIdea) + " " : ""}${winner?.title ?? "Removed idea"}`}</span>
            <span className="muted small">
              Drawn {date}
              {!hidden && round.winning_ticket && ` · ticket ${round.winning_ticket} of ${round.total_tickets}`} · {plural(round.locked.length, "passenger")}
            </span>
          </span>
          {!hidden && <span className="winner-pill mono-label">🏆 Winner</span>}
          {!hidden && <span className="hs-more">{open ? "Hide ▴" : "Details ▾"}</span>}
        </span>
      </button>
      {open && (
        <div className="history-body">
          <RoundFilterLine filters={round.filters} />
          <Breakdown round={round} />
          {winnerIdea?.status === "won" && (
            <button className="btn small" onClick={() => setDraft({ title: winnerIdea.title, places: winnerIdea.places, idea_id: winnerIdea.id })}>
              We went! Add to Been
            </button>
          )}
          {winnerIdea?.status === "done" && <p className="muted small">✓ Added to Been</p>}
          {isOwner && (
            <button className="link danger delete-draw" onClick={remove}>
              Delete this draw
            </button>
          )}
        </div>
      )}
      {draft && <TripForm draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
