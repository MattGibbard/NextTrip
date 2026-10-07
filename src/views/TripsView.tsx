import { useMemo, useState } from "react";
import type { Trip } from "../../shared/types";
import { MODES, MODE_KEYS, tripMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import { useData } from "../data";
import { continentOf } from "../continents";
import { nights } from "../format";
import { Flaps } from "../components/Ticket";
import { TripTicket } from "../components/TripTicket";
import { TripForm } from "./TripForm";

export function TripsView() {
  const { trips, people } = useData();
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);

  const stats = useMemo(() => {
    const countries = new Set<string>();
    const cities = new Set<string>();
    let away = 0;
    for (const t of trips) {
      away += nights(t.start_date, t.end_date) ?? 0;
      for (const p of t.places) {
        countries.add(p.country_code);
        cities.add(`${p.name}|${p.country_code}`);
      }
    }
    const continents = new Set([...countries].map(continentOf).filter(Boolean));
    return { countries: countries.size, cities: cities.size, nights: away, continents: continents.size };
  }, [trips]);

  // Trips arrive newest first, so the oldest trip is pass #01.
  const passNo = useMemo(() => new Map(trips.map((t, i) => [t.id, trips.length - i])), [trips]);
  const modeCounts = useMemo(() => {
    const counts = Object.fromEntries(MODE_KEYS.map((k) => [k, 0])) as Record<Mode, number>;
    for (const t of trips) counts[tripMode(t)]++;
    return counts;
  }, [trips]);

  const byYear = useMemo(() => {
    const groups = new Map<string, Trip[]>();
    for (const t of trips) {
      if (mode && tripMode(t) !== mode) continue;
      const y = t.start_date?.slice(0, 4) ?? "Undated";
      groups.set(y, [...(groups.get(y) ?? []), t]);
    }
    return [...groups.entries()];
  }, [trips, mode]);

  return (
    <section className="trips-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">ARRIVALS{people.length > 0 && <span className="desktop-only"> · {people.map((p) => p.name.toUpperCase()).join(" & ")}</span>}</div>
          <h1 className="display">Where we've been</h1>
          <p className="muted page-sub">Holidays you've had, kept as tickets.</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          + Add trip
        </button>
      </div>

      {trips.length > 0 && (
        <div className="flap-stats">
          <Flaps value={trips.length} label="TRIPS" />
          <Flaps value={stats.countries} label="COUNTRIES" />
          <Flaps value={stats.cities} label="CITIES" />
          <Flaps value={stats.nights} label="NIGHTS AWAY" />
          <Flaps value={stats.continents} label="CONTINENTS" />
        </div>
      )}

      {trips.length === 0 && (
        <div className="empty">
          <p>Nothing here yet. Add a holiday you've already been on to fill in your map and passport.</p>
          <button className="btn" onClick={() => setAdding(true)}>
            Add your first trip
          </button>
        </div>
      )}

      {trips.length > 1 && (
        <div className="mode-chips" aria-label="Filter by how you travelled">
          <button className={`mode-chip ${mode === null ? "on" : ""}`} onClick={() => setMode(null)}>
            All {trips.length}
          </button>
          {MODE_KEYS.filter((k) => modeCounts[k] > 0).map((k) => (
            <button key={k} className={`mode-chip ${mode === k ? "on" : ""}`} onClick={() => setMode(mode === k ? null : k)}>
              {MODES[k].icon} {MODES[k].label} {modeCounts[k]}
            </button>
          ))}
        </div>
      )}

      {byYear.map(([year, list]) => (
        <div key={year} className="ticket-year">
          <div className="year-rule">
            <span className="year-label">{year}</span>
            <span className="rule" />
            <span className="muted small">
              {list.length} {list.length === 1 ? "trip" : "trips"}
            </span>
          </div>
          <div className="ticket-grid">
            {list.map((t) => (
              <TripTicket key={t.id} trip={t} passNo={passNo.get(t.id) ?? 0} />
            ))}
          </div>
        </div>
      ))}

      {adding && <TripForm onClose={() => setAdding(false)} />}
    </section>
  );
}
