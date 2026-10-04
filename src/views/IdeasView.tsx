import { useMemo, useState } from "react";
import type { Idea } from "../../shared/types";
import { useData } from "../data";
import { flag } from "../countries";
import { IdeaForm } from "./IdeaForm";
import { TripForm } from "./TripForm";
import type { TripDraft } from "./TripForm";

const FILTERS = [
  { id: "active", label: "In the pool" },
  { id: "won", label: "Won" },
  { id: "done", label: "Been" },
] as const;

export function IdeasView() {
  const { ideas, people, personName } = useData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [editing, setEditing] = useState<Idea | "new" | null>(null);
  const [tripDraft, setTripDraft] = useState<TripDraft | null>(null);

  const shown = useMemo(() => ideas.filter((i) => i.status === filter), [ideas, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, ideas.filter((i) => i.status === f.id).length])), [ideas]);

  return (
    <section>
      <div className="page-head">
        <h1>Holiday ideas</h1>
        <button className="btn" onClick={() => setEditing("new")}>
          + New idea
        </button>
      </div>

      <div className="segmented">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => setFilter(f.id)}>
            {f.label} <span className="count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty">
          {filter === "active" ? (
            <>
              <p>No ideas in the pool yet. Add places you'd love to go, then spend your points on them in the Draw tab.</p>
              <button className="btn" onClick={() => setEditing("new")}>
                Add an idea
              </button>
            </>
          ) : (
            <p className="muted">{filter === "won" ? "Ideas that win a draw show up here." : "Won ideas you've turned into trips show up here."}</p>
          )}
        </div>
      )}

      <div className="card-grid">
        {shown.map((i) => {
          const creator = people.find((p) => p.id === i.created_by);
          return (
            <article key={i.id} className="card idea-card">
              <button className="card-body as-button" onClick={() => setEditing(i)}>
                <div className="idea-flags">{[...new Set(i.places.map((p) => p.country_code))].map(flag).join(" ") || "💡"}</div>
                <h3>{i.title}</h3>
                {i.places.length > 0 && <p className="small">{i.places.map((p) => p.name).join(" → ")}</p>}
                {i.description && <p className="muted small clamp">{i.description}</p>}
                <p className="muted small by">
                  <span className="dot" style={{ background: creator?.color ?? "#999" }} /> {personName(i.created_by)}'s idea
                </p>
              </button>
              {i.status === "won" && (
                <div className="card-actions">
                  <span className="badge win">🏆 Winner</span>
                  <button className="btn small" onClick={() => setTripDraft({ title: i.title, places: i.places, idea_id: i.id })}>
                    We've been! Add trip
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {editing && <IdeaForm idea={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {tripDraft && <TripForm draft={tripDraft} onClose={() => setTripDraft(null)} />}
    </section>
  );
}
