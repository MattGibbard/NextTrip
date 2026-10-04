import { useMemo, useState } from "react";
import type { Trip } from "../../shared/types";
import { useData } from "../data";
import { flag } from "../countries";
import { dateRange, plural } from "../format";
import { Stars } from "../components/Stars";
import { TripForm } from "./TripForm";

export function TripsView() {
  const { trips } = useData();
  const [editing, setEditing] = useState<Trip | "new" | null>(null);

  const stats = useMemo(() => {
    const countries = new Set<string>();
    const cities = new Set<string>();
    for (const t of trips)
      for (const p of t.places) {
        countries.add(p.country_code);
        cities.add(`${p.name}|${p.country_code}`);
      }
    return { countries: countries.size, cities: cities.size };
  }, [trips]);

  const byYear = useMemo(() => {
    const groups = new Map<string, Trip[]>();
    for (const t of trips) {
      const y = t.start_date?.slice(0, 4) ?? "Undated";
      groups.set(y, [...(groups.get(y) ?? []), t]);
    }
    return [...groups.entries()];
  }, [trips]);

  return (
    <section>
      <div className="page-head">
        <h1>Our trips</h1>
        <button className="btn" onClick={() => setEditing("new")}>
          + Add trip
        </button>
      </div>

      <div className="stats">
        <div>
          <strong>{trips.length}</strong>
          <span>{trips.length === 1 ? "trip" : "trips"}</span>
        </div>
        <div>
          <strong>{stats.countries}</strong>
          <span>{stats.countries === 1 ? "country" : "countries"}</span>
        </div>
        <div>
          <strong>{stats.cities}</strong>
          <span>{stats.cities === 1 ? "city" : "cities"}</span>
        </div>
      </div>

      {trips.length === 0 && (
        <div className="empty">
          <p>No trips yet. Add the holidays you've already been on to fill in your map.</p>
          <button className="btn" onClick={() => setEditing("new")}>
            Add your first trip
          </button>
        </div>
      )}

      {byYear.map(([year, list]) => (
        <div key={year} className="year-group">
          <h2 className="year">{year}</h2>
          <div className="card-grid">
            {list.map((t) => (
              <TripCard key={t.id} trip={t} onClick={() => setEditing(t)} />
            ))}
          </div>
        </div>
      ))}

      {editing && <TripForm trip={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const countries = [...new Map(trip.places.map((p) => [p.country_code, p.country])).entries()];
  const dates = dateRange(trip.start_date, trip.end_date);
  return (
    <button className="card trip-card" onClick={onClick}>
      {trip.cover_url ? (
        <div className="cover" style={{ backgroundImage: `url("${trip.cover_url.replace(/"/g, "%22")}")` }} />
      ) : (
        <div className="cover placeholder">{countries.map(([c]) => flag(c)).join(" ") || "🧳"}</div>
      )}
      <div className="card-body">
        <h3>{trip.title}</h3>
        {dates && <p className="muted small">{dates}</p>}
        {trip.places.length > 0 && (
          <p className="small">
            {countries.map(([c]) => flag(c)).join(" ")} {trip.places.map((p) => p.name).join(" · ")}
          </p>
        )}
        <div className="card-foot">
          {trip.rating ? <Stars value={trip.rating} /> : <span />}
          {trip.places.length > 0 && <span className="muted small">{plural(trip.places.length, "place")}</span>}
        </div>
      </div>
    </button>
  );
}
