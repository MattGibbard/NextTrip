import { useMemo, useState } from "react";
import type { Idea, Trip } from "../../shared/types";
import { MODES, MODE_KEYS, ideaMode, ticketEnds, tripMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import { budgetLabel, tripLengthLabel } from "../../shared/ideaDetails";
import { useData } from "../data";
import { flag } from "../countries";
import { continentOf } from "../continents";
import { nights, shortRange } from "../format";
import { Stars } from "../components/Stars";
import { Field, Flaps, Photo, RouteLine } from "../components/Ticket";
import { TripForm } from "./TripForm";
import type { TripDraft } from "./TripForm";

const flagsOf = (places: { country_code: string }[]) => [...new Set(places.map((p) => p.country_code))].map(flag).join(" ");

export function TripsView() {
  const { trips, people } = useData();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TripDraft | null>(null);
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
          {people.length > 0 && <div className="eyebrow desktop-only">PASSPORT · {people.map((p) => p.name.toUpperCase()).join(" & ")}</div>}
          <h1 className="display">Our trips</h1>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          + Add trip
        </button>
      </div>

      <NextDeparture onBeen={setDraft} />

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
          <p>No trips yet. Add the holidays you've already been on to fill in your map.</p>
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
      {draft && <TripForm draft={draft} onClose={() => setDraft(null)} />}
    </section>
  );
}

function TripTicket({ trip, passNo }: { trip: Trip; passNo: number }) {
  const { home } = useData();
  const mode = tripMode(trip);
  const m = MODES[mode];
  const ends = ticketEnds(mode, trip, home);
  const n = nights(trip.start_date, trip.end_date);
  const flags = flagsOf(trip.places);
  const ordered = mode !== "flight";
  return (
    <a className={`ticket mode-${mode}`} href={`#/trips/${trip.id}`}>
      <Photo url={trip.cover_url} fallback={flags || "🧳"} className="ticket-photo" />
      <div className="ticket-body">
        <div className="ticket-top">
          <span className="mode-ink">
            {m.icon} {ends ? `${ends.from.code} → ${ends.to.code}` : m.kind}
          </span>
          {n && <span className="muted desktop-only">{n} NIGHTS</span>}
        </div>
        <div className="ticket-title">{trip.title}</div>
        <div className="muted ticket-line">{shortRange(trip.start_date, trip.end_date) ?? "No dates yet"}</div>
        {trip.places.length > 0 && (
          <div className="ticket-line ellipsis desktop-only">
            {flags} {trip.places.map((p) => p.name).join(ordered ? " → " : " · ")}
          </div>
        )}
        <div className="ticket-foot">{trip.rating ? <Stars value={trip.rating} /> : null}</div>
      </div>
      <div className="ticket-stub">
        <span className="desktop-only">{m.icon}</span>
        <span className="stub-text">{m.kind}</span>
        <span className="desktop-only stub-no">#{String(passNo).padStart(2, "0")}</span>
      </div>
    </a>
  );
}

/** The idea that won the latest draw and hasn't been turned into a trip yet, as a boarding pass. */
function NextDeparture({ onBeen }: { onBeen: (d: TripDraft) => void }) {
  const { ideas, rounds, people, home } = useData();
  const won = ideas.filter((i) => i.status === "won");
  if (won.length === 0) return null;
  // Rounds arrive newest first; fall back to any won idea if its round is gone.
  const round = rounds.find((r) => r.status === "drawn" && won.some((i) => i.id === r.winner_idea_id));
  const idea: Idea = won.find((i) => i.id === round?.winner_idea_id) ?? won[0];
  const mode = ideaMode(idea.holiday_types);
  // You get there by air (unless it's a train journey, or a cruise from a port you've set), then carry on by sea or road.
  const arrival: Mode = mode === "train" ? "train" : mode === "cruise" && idea.depart ? "cruise" : "flight";
  // A road trip's ends are the airports it flies between.
  const ends = ticketEnds(idea.depart || idea.arrive ? mode : arrival, idea, home);
  const flags = flagsOf(idea.places);
  const then = mode === "cruise" || mode === "road" ? `${MODES[mode].icon} ${mode === "cruise" ? "Sail" : "Drive"} ${idea.places.length} stops` : null;
  const passengers = people.map((p) => p.name).join(" & ") || "—";
  const been = () => onBeen({ title: idea.title, places: idea.places, idea_id: idea.id, depart: idea.depart, arrive: idea.arrive });

  return (
    <div className="departure">
      <div className="departure-main">
        <div className="departure-head">
          <span className="mono-label">NEXT DEPARTURE · {MODES[arrival].kind}</span>
          {round && <span className="departure-badge">🏆 Won in the {round.name} draw</span>}
        </div>
        {ends ? <RouteLine from={ends.from} to={ends.to} icon={MODES[arrival].icon} /> : <div className="departure-flags">{flags || "🏆"}</div>}
        <div className="departure-fields">
          <Field label="TRIP" className="departure-trip">
            <a href={`#/ideas/${idea.id}`}>
              {flags} {idea.title}
            </a>
          </Field>
          <Field label="PASSENGERS" className="desktop-only">
            {passengers}
          </Field>
          <Field label="LENGTH" className="desktop-only">
            {tripLengthLabel(idea.trip_length) ?? "—"}
          </Field>
          {then ? (
            <Field label="THEN">{then}</Field>
          ) : (
            <Field label="BUDGET">{budgetLabel(idea.budget) ?? "—"}</Field>
          )}
        </div>
        <button className="btn departure-been mobile-only" onClick={been}>
          We've been! Add trip
        </button>
      </div>
      <div className="departure-side desktop-only">
        <Photo url={idea.cover_url} fallback={flags || "🏆"} className="fill" />
        <div className="departure-actions">
          {round?.winning_ticket && round.total_tickets && (
            <span className="ticket-tag">
              TICKET {round.winning_ticket} / {round.total_tickets}
            </span>
          )}
          <button className="departure-been" onClick={been}>
            We've been! Add trip
          </button>
        </div>
      </div>
      <span className="notch top" />
      <span className="notch bottom" />
    </div>
  );
}
