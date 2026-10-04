import { useMemo, useState } from "react";
import { useData } from "../data";
import { flag } from "../countries";
import { cssUrl, dateRange, plural } from "../format";
import { Stars } from "../components/Stars";
import { WorldMap } from "../components/WorldMap";
import type { Pin, Route } from "../components/WorldMap";
import { TripForm } from "./TripForm";

const NONE = new Set<string>();

/** Everything about one trip: photo, dates, rating, notes and its route on a map. */
export function TripPage({ id }: { id: number }) {
  const { trips, ideas, people, personName } = useData();
  const trip = trips.find((t) => t.id === id);
  const [editing, setEditing] = useState(false);

  const countries = useMemo(() => new Set(trip?.places.map((p) => p.country_code) ?? []), [trip]);
  const pins = useMemo<Pin[]>(
    () =>
      (trip?.places ?? []).flatMap((p) => (p.lat !== null && p.lon !== null ? [{ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "visited" as const }] : [])),
    [trip],
  );
  const routes = useMemo<Route[]>(() => (trip ? [{ places: trip.places, inOrder: trip.road_trip || trip.cruise, label: trip.title, kind: "visited" }] : []), [trip]);

  if (!trip) {
    return (
      <section>
        <a className="back-link" href="#/trips">
          ← Trips
        </a>
        <p className="muted center">This trip has been deleted.</p>
      </section>
    );
  }

  const creator = people.find((p) => p.id === trip.created_by);
  const idea = ideas.find((i) => i.id === trip.idea_id);
  const dates = dateRange(trip.start_date, trip.end_date);

  return (
    <section className="idea-page">
      <div className="page-head">
        <a className="back-link" href="#/trips">
          ← Trips
        </a>
        <button className="btn" onClick={() => setEditing(true)}>
          ✏️ Edit
        </button>
      </div>

      {trip.cover_url ? (
        <div className="hero" style={{ backgroundImage: cssUrl(trip.cover_url) }} />
      ) : (
        <div className="hero placeholder">{[...countries].map(flag).join(" ") || "🧳"}</div>
      )}

      <h1>{trip.title}</h1>
      <p className="muted small">
        {dates ?? "No dates yet"}
        {creator && (
          <>
            {" · "}
            <span className="dot" style={{ background: creator.color }} /> Added by {personName(trip.created_by)}
          </>
        )}
      </p>

      <div className="trip-meta">
        {trip.rating ? <Stars value={trip.rating} /> : <span className="muted small">Not rated</span>}
        {trip.road_trip && <span className="detail">🚗 Road trip</span>}
        {trip.cruise && <span className="detail">🛳️ Cruise</span>}
        {idea && (
          <a className="detail" href={`#/ideas/${idea.id}`}>
            🏆 From the idea "{idea.title}"
          </a>
        )}
      </div>

      {trip.notes && <p className="idea-notes">{trip.notes}</p>}

      <h2>{trip.places.length ? plural(trip.places.length, "place") : "Places"}</h2>
      {trip.places.length > 0 ? (
        <>
          <ol className="stops">
            {trip.places.map((p, i) => (
              <li key={i}>
                {flag(p.country_code)} <strong>{p.name}</strong> <span className="muted small">{p.country}</span>
              </li>
            ))}
          </ol>
          <div className="map-wrap">
            <WorldMap visited={countries} ideas={NONE} pins={pins} routes={routes} selected={null} onSelect={() => {}} close />
          </div>
        </>
      ) : (
        <p className="muted small">No places yet. Add some with Edit.</p>
      )}

      {editing && <TripForm trip={trip} onClose={() => setEditing(false)} onDeleted={() => (location.hash = "/trips")} />}
    </section>
  );
}
