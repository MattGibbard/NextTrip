import { useMemo, useState } from "react";
import { useData } from "../data";
import { flag } from "../countries";
import { cssUrl, plural } from "../format";
import { budgetLabel, holidayType, travelTimeLabel, tripLengthLabel } from "../../shared/ideaDetails";
import { ticketRanges } from "../../shared/draw";
import { WorldMap } from "../components/WorldMap";
import type { Pin } from "../components/WorldMap";
import { IdeaForm } from "./IdeaForm";
import { TripForm } from "./TripForm";
import type { TripDraft } from "./TripForm";

const STATUS = {
  active: "In the pool",
  won: "🏆 Won a draw",
  done: "✓ Been",
  archived: "Archived",
} as const;

const NONE = new Set<string>();

/** Everything about one idea: photo, details, places on a map and its draw history. */
export function IdeaPage({ id }: { id: number }) {
  const { ideas, trips, rounds, people, personName } = useData();
  const idea = ideas.find((i) => i.id === id);
  const [editing, setEditing] = useState(false);
  const [tripDraft, setTripDraft] = useState<TripDraft | null>(null);

  const countries = useMemo(() => new Set(idea?.places.map((p) => p.country_code) ?? []), [idea]);
  const pins = useMemo<Pin[]>(
    () =>
      (idea?.places ?? []).flatMap((p) => (p.lat !== null && p.lon !== null ? [{ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "idea" as const }] : [])),
    [idea],
  );

  // Drawn rounds this idea was in, with its share of the tickets.
  const history = useMemo(
    () =>
      rounds
        .filter((r) => r.status === "drawn")
        .flatMap((r) => {
          const ranges = ticketRanges(r.allocations);
          const mine = ranges.find((x) => x.idea_id === id)?.tickets ?? 0;
          if (!mine) return [];
          const total = ranges.reduce((n, x) => n + x.tickets, 0);
          return [{ round: r, tickets: mine, total, won: r.winner_idea_id === id }];
        }),
    [rounds, id],
  );

  if (!idea) {
    return (
      <section>
        <a className="back-link" href="#/ideas">
          ← Ideas
        </a>
        <p className="muted center">This idea has been deleted.</p>
      </section>
    );
  }

  const creator = people.find((p) => p.id === idea.created_by);
  const trip = trips.find((t) => t.idea_id === idea.id);
  const type = idea.holiday_types.map(holidayType).filter((t) => t !== undefined);
  const facts = [
    ["Budget", budgetLabel(idea.budget)],
    ["Trip length", tripLengthLabel(idea.trip_length)],
    ["Travel time", travelTimeLabel(idea.travel_time)],
    ["Type", type.map((t) => `${t.icon} ${t.label}`).join(", ") || null],
  ] as const;

  return (
    <section className="idea-page">
      <div className="page-head">
        <a className="back-link" href="#/ideas">
          ← Ideas
        </a>
        <button className="btn" onClick={() => setEditing(true)}>
          ✏️ Edit
        </button>
      </div>

      {idea.cover_url ? (
        <div className="hero" style={{ backgroundImage: cssUrl(idea.cover_url) }} />
      ) : (
        <div className="hero placeholder">{[...countries].map(flag).join(" ") || "💡"}</div>
      )}

      <h1>{idea.title}</h1>
      <p className="muted small">
        <span className="dot" style={{ background: creator?.color ?? "#999" }} /> {personName(idea.created_by)}'s idea · {STATUS[idea.status]}
      </p>

      {idea.status === "won" && (
        <div className="panel win-panel">
          <span className="grow">This one won a draw. Been yet?</span>
          <button className="btn small" onClick={() => setTripDraft({ title: idea.title, places: idea.places, idea_id: idea.id })}>
            We've been! Add trip
          </button>
        </div>
      )}
      {trip && (
        <p className="small">
          ✓ You went: <a href="#/trips">{trip.title}</a>
        </p>
      )}

      <dl className="facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value ? "" : "muted"}>{value ?? "Not set"}</dd>
          </div>
        ))}
      </dl>

      {idea.description && <p className="idea-notes">{idea.description}</p>}

      <h2>{idea.places.length ? plural(idea.places.length, "place") : "Places"}</h2>
      {idea.places.length > 0 ? (
        <>
          <ol className="stops">
            {idea.places.map((p, i) => (
              <li key={i}>
                {flag(p.country_code)} <strong>{p.name}</strong> <span className="muted small">{p.country}</span>
              </li>
            ))}
          </ol>
          <div className="map-wrap">
            <WorldMap visited={NONE} ideas={countries} pins={pins} selected={null} onSelect={() => {}} />
          </div>
        </>
      ) : (
        <p className="muted small">No places yet. Add some with Edit.</p>
      )}

      {history.length > 0 && (
        <>
          <h2>In the draw</h2>
          <ul className="list compact">
            {history.map((h) => (
              <li key={h.round.id} className="list-row">
                <span className="grow">
                  {h.won && "🏆 "}
                  {h.round.name}
                </span>
                <span className="muted small">
                  {plural(h.tickets, "ticket")} of {h.total} · {Math.round((h.tickets / h.total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && <IdeaForm idea={idea} onClose={() => setEditing(false)} onDeleted={() => (location.hash = "/ideas")} />}
      {tripDraft && <TripForm draft={tripDraft} onClose={() => setTripDraft(null)} />}
    </section>
  );
}
