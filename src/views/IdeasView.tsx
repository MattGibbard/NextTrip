import { useMemo, useState } from "react";
import { useData } from "../data";
import { flag } from "../countries";
import { IdeaDetailsLine } from "../components/IdeaDetails";
import { BUDGETS, HOLIDAY_TYPES } from "../../shared/ideaDetails";
import { IdeaForm } from "./IdeaForm";
import { plural } from "../format";
import type { Idea } from "../../shared/types";
import { MODES, ideaMode, ticketEnds } from "../../shared/travelMode";
import { Photo } from "../components/Ticket";
import { TripForm } from "./TripForm";
import type { TripDraft } from "./TripForm";

const FILTERS = [
  { id: "active", label: "In the pool" },
  { id: "won", label: "Won" },
  { id: "done", label: "Been" },
] as const;

export function IdeasView() {
  const { ideas } = useData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [adding, setAdding] = useState(false);
  const [tripDraft, setTripDraft] = useState<TripDraft | null>(null);

  const [budget, setBudget] = useState<number | null>(null);
  const [type, setType] = useState<string | null>(null);

  const inTab = useMemo(() => ideas.filter((i) => i.status === filter), [ideas, filter]);
  const typesInUse = useMemo(() => HOLIDAY_TYPES.filter((t) => inTab.some((i) => i.holiday_types.includes(t.key))), [inTab]);
  const shown = useMemo(
    () =>
      inTab.filter(
        (i) => (budget === null || i.budget === budget) && (type === null || i.holiday_types.some((t) => t === type)),
      ),
    [inTab, budget, type],
  );
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, ideas.filter((i) => i.status === f.id).length])), [ideas]);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow standby-ink desktop-only">DEPARTURES · STANDBY</div>
          <h1 className="display">Holiday ideas</h1>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          + New idea
        </button>
      </div>

      <div className="ideas-controls">
      <div className="segmented">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => (setFilter(f.id), setBudget(null), setType(null))}>
            {f.label} <span className="count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {inTab.length > 1 && (
        <div className="filter-row" aria-label="Filter ideas">
          {BUDGETS.filter((b) => inTab.some((i) => i.budget === b.key)).map((b) => (
            <button key={b.key} className={`choice small ${budget === b.key ? "on" : ""}`} onClick={() => setBudget(budget === b.key ? null : b.key)}>
              {b.label}
            </button>
          ))}
          {typesInUse.map((t) => (
            <button key={t.key} className={`choice small ${type === t.key ? "on" : ""}`} onClick={() => setType(type === t.key ? null : t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
      </div>

      {filter === "active" && counts.active > 0 && (
        <div className="draw-prompt">
          <span className="draw-prompt-icon">🎟️</span>
          <div className="grow">
            <strong>{plural(counts.active, "idea")} on standby</strong>
            <div className="desktop-only">Start a round to spread your points and see which one gets a seat.</div>
          </div>
          <a className="btn bright" href="#/draw">
            Start a draw
          </a>
        </div>
      )}

      {inTab.length > 0 && shown.length === 0 && <p className="muted center">No ideas match those filters.</p>}

      {inTab.length === 0 && (
        <div className="empty">
          {filter === "active" ? (
            <>
              <p>No ideas in the pool yet. Add places you'd love to go, then spend your points on them in the Draw tab.</p>
              <button className="btn" onClick={() => setAdding(true)}>
                Add an idea
              </button>
            </>
          ) : (
            <p className="muted">{filter === "won" ? "Ideas that win a draw show up here." : "Won ideas you've turned into trips show up here."}</p>
          )}
        </div>
      )}

      <div className="standby-grid">
        {shown.map((i) => (
          <StandbyCard key={i.id} idea={i} onBeen={() => setTripDraft({ title: i.title, places: i.places, idea_id: i.id, depart: i.depart, arrive: i.arrive })} />
        ))}
      </div>

      {adding && <IdeaForm onClose={() => setAdding(false)} />}
      {tripDraft && <TripForm draft={tripDraft} onClose={() => setTripDraft(null)} />}
    </section>
  );
}

function StandbyCard({ idea: i, onBeen }: { idea: Idea; onBeen: () => void }) {
  const { people, personName, home } = useData();
  const creator = people.find((p) => p.id === i.created_by);
  const mode = ideaMode(i.holiday_types);
  const m = MODES[mode];
  const ends = ticketEnds(mode, i, home);
  const flags = [...new Set(i.places.map((p) => p.country_code))].map(flag).join(" ");
  const tag = i.status === "won" ? "🏆 WINNER" : i.status === "done" ? "✓ BEEN" : "STANDBY";
  return (
    <article className={`standby-card mode-${mode}`}>
      <a className="standby-link" href={`#/ideas/${i.id}`}>
        <div className="standby-photo">
          <Photo url={i.cover_url} fallback={flags || "💡"} className="fill" />
          <span className="standby-tag">
            {tag} · {m.icon} {ends ? `${ends.from.code} → ${ends.to.code}` : m.kind}
          </span>
        </div>
        <div className="perf" aria-hidden />
        <div className="standby-body">
          <div className="standby-name">
            <span className="standby-flags">{flags || "💡"}</span>
            <h3>{i.title}</h3>
          </div>
          {i.places.length > 0 && <p className="small">{i.places.map((p) => p.name).join(" → ")}</p>}
          <IdeaDetailsLine idea={i} />
          <div className="standby-foot">
            <span>
              <span className="dot" style={{ background: creator?.color ?? "#999" }} /> {personName(i.created_by)}'s idea
            </span>
            <span className="mono-label mode-ink desktop-only">{m.kind}</span>
          </div>
        </div>
      </a>
      {i.status === "won" && (
        <div className="card-actions">
          <span className="badge win">🏆 Winner</span>
          <button className="btn small" onClick={onBeen}>
            We've been! Add trip
          </button>
        </div>
      )}
    </article>
  );
}
