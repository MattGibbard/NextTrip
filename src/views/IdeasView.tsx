import { useMemo, useState } from "react";
import { findDestination, ideaFromDestination } from "../destinations";
import { useData } from "../data";
import { BUDGETS, HOLIDAY_TYPES } from "../../shared/ideaDetails";
import { IdeaForm } from "./IdeaForm";
import { plural } from "../format";
import { StandbyCard } from "../components/StandbyCard";
import { TripForm } from "./TripForm";
import type { TripDraft } from "./TripForm";
import { NextDeparture } from "../components/NextDeparture";

const FILTERS = [
  { id: "active", label: "In the pool" },
  { id: "won", label: "Won" },
  { id: "done", label: "Done" },
] as const;

/** addFrom: a destination guide's slug, when its "Add to ideas" brought us here. */
export function IdeasView({ addFrom = null }: { addFrom?: string | null }) {
  const { ideas } = useData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const guide = addFrom ? findDestination(addFrom) : undefined;
  const [adding, setAdding] = useState(!!guide);
  const closeForm = () => {
    setAdding(false);
    if (guide) location.hash = "/next";
  };
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
          <div className="eyebrow standby-ink">DEPARTURES · STANDBY</div>
          <h1 className="display">Where next?</h1>
          <p className="muted page-sub">Places you might go. Vote on them, then let the draw pick.</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          + New idea
        </button>
      </div>

      <NextDeparture onBeen={setTripDraft} />

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
            <p className="muted">{filter === "won" ? "Ideas that win a draw show up here." : "Ideas you've been on show up here, and their trips are in Been."}</p>
          )}
        </div>
      )}

      <div className="standby-grid">
        {shown.map((i) => (
          <StandbyCard key={i.id} idea={i} onBeen={() => setTripDraft({ title: i.title, places: i.places, idea_id: i.id, depart: i.depart, arrive: i.arrive })} />
        ))}
      </div>

      {adding && <IdeaForm initial={guide && ideaFromDestination(guide)} onClose={closeForm} />}
      {tripDraft && <TripForm draft={tripDraft} onClose={() => setTripDraft(null)} />}
    </section>
  );
}
