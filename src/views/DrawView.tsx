import { useEffect, useMemo, useRef, useState } from "react";
import type { Idea, Round } from "../../shared/types";
import { ticketRanges } from "../../shared/draw";
import { api } from "../api";
import { useData } from "../data";
import { flag } from "../countries";
import { load, save } from "../storage";
import { plural } from "../format";
import { TripForm } from "./TripForm";
import { IdeaDetailsLine } from "../components/IdeaDetails";
import { SpinWheel } from "../components/SpinWheel";
import { RoundFilterFields, RoundFilterLine } from "../components/RoundFilters";
import { NO_FILTERS, hasFilters, matchesFilters } from "../../shared/roundFilters";
import type { RoundFilters } from "../../shared/roundFilters";
import type { TripDraft } from "./TripForm";

export function DrawView() {
  const { rounds, reload } = useData();
  const open = rounds.find((r) => r.status === "open");
  const drawn = rounds.filter((r) => r.status === "drawn");
  const [seen, setSeen] = useState<number[]>(() => load("seenRounds", []));
  const [revealing, setRevealing] = useState<Round | null>(null);

  // Keep the lock-in status fresh while a round is open, so the partner's progress shows up.
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
    <section>
      <div className="page-head">
        <h1>Holiday draw</h1>
      </div>

      {revealing ? (
        <Reveal
          round={revealing}
          onDone={() => {
            markSeen(revealing.id);
          }}
          onClose={() => setRevealing(null)}
        />
      ) : unseen ? (
        <div className="panel reveal-cta">
          <p className="big">🎟️ {unseen.name} has been drawn!</p>
          <p className="muted">Ready to find out where you're going?</p>
          <button className="btn large" onClick={() => setRevealing(unseen)}>
            Reveal the winner
          </button>
        </div>
      ) : open ? (
        <OpenRound round={open} onDrawn={(r) => setRevealing(r)} />
      ) : (
        <StartRound lastPoints={drawn[0]?.points_per_person ?? 10} />
      )}

      {drawn.length > 0 && (
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

function StartRound({ lastPoints }: { lastPoints: number }) {
  const { ideas, reload } = useData();
  const [points, setPoints] = useState(lastPoints);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RoundFilters>(NO_FILTERS);
  const pool = ideas.filter((i) => i.status === "active");
  const matching = pool.filter((i) => matchesFilters(i, filters));
  const filtered = hasFilters(filters);

  const start = async () => {
    try {
      await api.createRound({ name: name.trim() || undefined, points_per_person: points, filters });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="panel">
      <h2>Start a new round</h2>
      <p className="muted">
        You each get the same number of points to spread across the ideas in the pool. Points stay secret until you've both locked in. Then every point becomes one ticket in the draw.
      </p>
      {pool.length < 2 ? (
        <p className="banner">
          Add at least two ideas to the pool first (there {pool.length === 1 ? "is 1" : `are ${pool.length}`} now). <a href="#/ideas">Go to ideas</a>
        </p>
      ) : (
        <div className="form">
          <div className="row two">
            <label>
              Round name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer 2027" />
            </label>
            <label>
              Points each
              <input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <details className="filters-box" open={filtered || undefined}>
            <summary>Filter ideas{filtered ? "" : " (optional)"}</summary>
            <RoundFilterFields value={filters} onChange={setFilters} />
          </details>
          <p className={`match-count small ${matching.length < 2 ? "error-text" : "muted"}`}>
            {filtered
              ? `${matching.length} of ${plural(pool.length, "idea")} match${matching.length < 2 ? ". You need at least 2 to start a round." : ""}`
              : `All ${plural(pool.length, "idea")} in the pool are in this round.`}
            {filtered && (
              <>
                {" "}
                <button className="link" onClick={() => setFilters(NO_FILTERS)}>
                  Clear filters
                </button>
              </>
            )}
          </p>
          {error && <p className="error-text">{error}</p>}
          <button className="btn large" onClick={start} disabled={matching.length < 2}>
            Start round with {plural(points, "point")} each
          </button>
        </div>
      )}
    </div>
  );
}

function OpenRound({ round, onDrawn }: { round: Round; onDrawn: (r: Round) => void }) {
  const { people, me, reload } = useData();
  const iLocked = me ? round.locked.includes(me.id) : false;
  const everyone = people.every((p) => round.locked.includes(p.id));
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="panel">
      <div className="round-head">
        <div>
          <h2>{round.name}</h2>
          <p className="muted small">{plural(round.points_per_person, "point")} each</p>
          <RoundFilterLine filters={round.filters} />
        </div>
        <button className="link danger" onClick={cancel}>
          Cancel round
        </button>
      </div>

      <ul className="lock-status">
        {people.map((p) => {
          const locked = round.locked.includes(p.id);
          return (
            <li key={p.id} className={locked ? "locked" : ""}>
              <span className="avatar" style={{ background: p.color }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="grow">
                {p.name}
                {p.id === me?.id ? " (you)" : ""}
              </span>
              {round.vetoes.some((v) => v.person_id === p.id) && <span className="veto-used" title="Veto used">🚫</span>}
              <span className="state">{locked ? "🔒 Locked in" : "Choosing…"}</span>
            </li>
          );
        })}
      </ul>

      <Vetoes round={round} />

      {everyone ? (
        <div className="draw-ready">
          <p>Everyone's locked in. Time to find out where you're going.</p>
          {error && <p className="error-text">{error}</p>}
          <button className="btn large glow" onClick={draw} disabled={drawing}>
            {drawing ? "Drawing…" : "🎟️ Start the draw"}
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
    </div>
  );
}

/** Lists the ideas knocked out of this round, with an undo for your own veto. */
function Vetoes({ round }: { round: Round }) {
  const { me, people, reload } = useData();
  const [error, setError] = useState<string | null>(null);
  if (round.vetoes.length === 0) return null;
  const iLocked = me ? round.locked.includes(me.id) : false;
  const undo = async () => {
    try {
      await api.unveto(round.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <ul className="veto-list">
      {round.vetoes.map((v) => {
        const who = people.find((p) => p.id === v.person_id);
        const title = round.ideas.find((i) => i.id === v.idea_id)?.title ?? "An idea";
        return (
          <li key={v.person_id}>
            <span className="grow">
              🚫 <s>{title}</s> <span className="muted small">vetoed by {v.person_id === me?.id ? "you" : (who?.name ?? "someone")}</span>
            </span>
            {v.person_id === me?.id && !iLocked && (
              <button className="link" onClick={undo}>
                Undo
              </button>
            )}
          </li>
        );
      })}
      {error && <li className="error-text">{error}</li>}
    </ul>
  );
}

function MyLockedPoints({ round }: { round: Round }) {
  const { ideas, reload, people, me } = useData();
  const waitingOn = people.filter((p) => !round.locked.includes(p.id)).map((p) => p.name);
  return (
    <div>
      <p>
        You're locked in. Waiting on <strong>{waitingOn.join(" and ")}</strong>.
      </p>
      <ul className="list compact">
        {round.allocations
          .filter((a) => a.person_id === me?.id)
          .map((a) => (
            <li key={a.idea_id} className="list-row">
              <span className="grow">{ideas.find((i) => i.id === a.idea_id)?.title ?? "Idea"}</span>
              <span className="pill">{plural(a.points, "pt")}</span>
            </li>
          ))}
      </ul>
      <button className="btn ghost" onClick={() => void api.unlock(round.id).then(reload)}>
        Change my points
      </button>
    </div>
  );
}

function Allocator({ round }: { round: Round }) {
  const { ideas, me, reload } = useData();
  const vetoed = useMemo(() => new Set(round.vetoes.map((v) => v.idea_id)), [round.vetoes]);
  const pool = useMemo(
    () => ideas.filter((i) => i.status === "active" && !vetoed.has(i.id) && matchesFilters(i, round.filters)),
    [ideas, vetoed, round.filters],
  );
  const canVeto = !round.vetoes.some((v) => v.person_id === me?.id) && pool.length > 1;
  const [points, setPoints] = useState<Record<number, number>>(() =>
    Object.fromEntries(round.allocations.filter((a) => a.person_id === me?.id).map((a) => [a.idea_id, a.points])),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<unknown> | null>(null);
  const dirty = useRef(false);

  const live = pool.map((i) => ({ idea_id: i.id, points: points[i.id] ?? 0 }));
  const spent = live.reduce((n, a) => n + a.points, 0);
  const left = round.points_per_person - spent;

  // Save shortly after the last change, so both devices see a consistent picture.
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
    if (!confirm(`Use your one veto on "${idea.title}"? It's out of this round for both of you, and any points on it go back.`)) return;
    try {
      await api.veto(round.id, idea.id);
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

  return (
    <div className="allocator">
      <div className={`points-left ${left === 0 ? "done" : ""}`}>
        <strong>{left}</strong> of {round.points_per_person} points left
        <span className="save-state">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
      </div>
      <p className="muted small">
        {me?.name}, your points are hidden from everyone else until the draw.
        {canVeto && " You also have one veto to knock an idea out of this round."}
      </p>

      <ul className="alloc-list">
        {pool.map((i) => (
          <AllocRow
            key={i.id}
            idea={i}
            points={points[i.id] ?? 0}
            canAdd={left > 0}
            onChange={(d) => change(i.id, d)}
            onVeto={canVeto ? () => veto(i) : undefined}
          />
        ))}
      </ul>

      {error && <p className="error-text">{error}</p>}
      <button className="btn large" disabled={left !== 0} onClick={lock}>
        {left === 0 ? "🔒 Lock in my points" : `Spend ${plural(left, "more point")} to lock in`}
      </button>
    </div>
  );
}

function AllocRow({
  idea,
  points,
  canAdd,
  onChange,
  onVeto,
}: {
  idea: Idea;
  points: number;
  canAdd: boolean;
  onChange: (delta: number) => void;
  onVeto?: () => void;
}) {
  const { personName } = useData();
  return (
    <li className={`alloc-row ${points > 0 ? "has" : ""}`}>
      <div className="grow">
        <strong>
          {[...new Set(idea.places.map((p) => p.country_code))].map(flag).join(" ")} {idea.title}
        </strong>
        <div className="muted small">
          {idea.places.map((p) => p.name).join(" → ") || "No places yet"} · {personName(idea.created_by)}
        </div>
        <IdeaDetailsLine idea={idea} />
        {onVeto && (
          <button className="link danger veto-link" onClick={onVeto}>
            🚫 Veto
          </button>
        )}
      </div>
      <div className="stepper">
        <button onClick={() => onChange(-1)} disabled={points === 0} aria-label={`Remove a point from ${idea.title}`}>
          −
        </button>
        <span className="value">{points}</span>
        <button onClick={() => onChange(1)} disabled={!canAdd} aria-label={`Add a point to ${idea.title}`}>
          +
        </button>
      </div>
    </li>
  );
}

/** Weighted slot-machine style reveal, then the full breakdown. */
function Reveal({ round, onDone, onClose }: { round: Round; onDone: () => void; onClose: () => void }) {
  const ranges = useMemo(() => ticketRanges(round.allocations), [round]);
  const titleOf = (id: number) => round.ideas.find((i) => i.id === id)?.title ?? "Idea";
  const [finished, setFinished] = useState(false);

  return (
    <div className="panel reveal">
      <p className="muted">{round.name}</p>
      <SpinWheel
        ranges={ranges}
        titleOf={titleOf}
        winningTicket={round.winning_ticket!}
        onLanded={() => {
          setFinished(true);
          onDone();
        }}
      />
      {finished ? (
        <>
          <p className="big">🎉 You're going to {titleOf(round.winner_idea_id!)}!</p>
          <p className="muted small">
            Ticket {round.winning_ticket} of {round.total_tickets}
          </p>
          <Breakdown round={round} />
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </>
      ) : (
        <p className="muted">Spinning…</p>
      )}
    </div>
  );
}

function Breakdown({ round }: { round: Round }) {
  const { people } = useData();
  const ranges = ticketRanges(round.allocations);
  const total = ranges.reduce((n, r) => n + r.tickets, 0);
  const rows = [...ranges].sort((a, b) => b.tickets - a.tickets);
  return (
    <div className="table-wrap">
      <table className="breakdown">
        <thead>
          <tr>
            <th>Idea</th>
            {people.map((p) => (
              <th key={p.id} className="num">
                <span className="dot" style={{ background: p.color }} /> {p.name}
              </th>
            ))}
            <th className="num">Odds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.idea_id} className={r.idea_id === round.winner_idea_id ? "winner" : ""}>
              <td>
                {r.idea_id === round.winner_idea_id && "🏆 "}
                {round.ideas.find((i) => i.id === r.idea_id)?.title ?? "Idea"}
              </td>
              {people.map((p) => (
                <td key={p.id} className="num">
                  {round.allocations.find((a) => a.person_id === p.id && a.idea_id === r.idea_id)?.points ?? "–"}
                </td>
              ))}
              <td className="num">{Math.round((r.tickets / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {round.vetoes.length > 0 && (
        <p className="muted small">
          Vetoed:{" "}
          {round.vetoes
            .map((v) => `${round.ideas.find((x) => x.id === v.idea_id)?.title ?? "an idea"} (${people.find((p) => p.id === v.person_id)?.name ?? "someone"})`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function HistoryRow({ round, hidden }: { round: Round; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const { ideas, reload } = useData();
  const remove = async () => {
    const back = winnerIdea?.status === "won" ? ` ${winnerIdea.title} goes back into the pool.` : "";
    if (!confirm(`Delete ${round.name} and everyone's points for it?${back}`)) return;
    await api.deleteRound(round.id);
    await reload();
  };
  const winner = round.ideas.find((i) => i.id === round.winner_idea_id);
  const winnerIdea: Idea | undefined = ideas.find((i) => i.id === round.winner_idea_id);
  const date = round.drawn_at ? new Date(round.drawn_at.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="history-row">
      <button className="history-head" onClick={() => !hidden && setOpen(!open)} disabled={hidden}>
        <div className="grow">
          <strong>{round.name}</strong>
          <div className="muted small">{date}</div>
        </div>
        <span className="winner-name">{hidden ? "Not revealed yet" : `🏆 ${winner?.title ?? "Removed idea"}`}</span>
        {!hidden && <span className="chev">{open ? "▴" : "▾"}</span>}
      </button>
      {open && (
        <div className="history-body">
          <RoundFilterLine filters={round.filters} />
          <Breakdown round={round} />
          {winnerIdea?.status === "won" && (
            <button className="btn small" onClick={() => setDraft({ title: winnerIdea.title, places: winnerIdea.places, idea_id: winnerIdea.id })}>
              We've been! Add as a trip
            </button>
          )}
          {winnerIdea?.status === "done" && <p className="muted small">✓ Added to your trips</p>}
          <button className="link danger delete-draw" onClick={remove}>
            Delete this draw
          </button>
        </div>
      )}
      {draft && <TripForm draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}
