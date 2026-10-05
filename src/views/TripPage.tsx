import { useMemo, useState } from "react";
import type { Place } from "../../shared/types";
import { MODES, placeCode, ticketEnds, tripMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import { useData } from "../data";
import { flag } from "../countries";
import { monthYear, nights, shortRange } from "../format";
import { Stars } from "../components/Stars";
import { Board, Pass } from "../components/Ticket";
import { WorldMap } from "../components/WorldMap";
import type { Pin, Route } from "../components/WorldMap";
import { TripForm } from "./TripForm";

const NONE = new Set<string>();

/** How each kind of trip labels its dates and its stops. */
const WORDING: Record<Mode, { went: string; board: string; column: string; notes: [string, string, string] }> = {
  flight: { went: "FLEW", board: "DESTINATIONS", column: "DESTINATION", notes: ["ARRIVED", "VISITED", "VISITED"] },
  train: { went: "TRAVELLED", board: "CALLING AT", column: "STATION", notes: ["DEPART", "CALLING", "ARRIVE"] },
  cruise: { went: "SAILED", board: "PORTS OF CALL", column: "PORT OF CALL", notes: ["EMBARK", "ASHORE", "DISEMBARK"] },
  road: { went: "DROVE", board: "THE ROUTE", column: "STOP", notes: ["SET OFF", "STOP", "FINISH"] },
};

function boardRows(mode: Mode, places: Place[]) {
  const [first, middle, last] = WORDING[mode].notes;
  return places.map((p, i) => {
    const note = places.length === 1 ? "VISITED" : i === 0 ? first : i === places.length - 1 ? last : middle;
    return { label: `${flag(p.country_code)} ${p.name}`, note, lit: places.length > 1 && (i === 0 || i === places.length - 1) && mode !== "flight" };
  });
}

/** Everything about one trip, laid out as the ticket for how you travelled. */
export function TripPage({ id }: { id: number }) {
  const { trips, ideas, people, personName, home } = useData();
  const trip = trips.find((t) => t.id === id);
  const [editing, setEditing] = useState(false);
  const mode = trip ? tripMode(trip) : "flight";

  const countries = useMemo(() => new Set(trip?.places.map((p) => p.country_code) ?? []), [trip]);
  const pins = useMemo<Pin[]>(
    () =>
      (trip?.places ?? []).flatMap((p) =>
        p.lat !== null && p.lon !== null ? [{ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "visited" as const, colorVar: `--${mode}-ink` }] : [],
      ),
    [trip, mode],
  );
  const routes = useMemo<Route[]>(
    () => (trip ? [{ places: trip.places, inOrder: mode !== "flight", label: trip.title, kind: "visited", colorVar: `--${mode}-ink` }] : []),
    [trip, mode],
  );

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

  const m = MODES[mode];
  const creator = people.find((p) => p.id === trip.created_by);
  const idea = ideas.find((i) => i.id === trip.idea_id);
  const ends = ticketEnds(mode, trip.places, home);
  const n = nights(trip.start_date, trip.end_date);
  // Pass numbers count up from the oldest trip; trips arrive newest first.
  const passNo = `#${String(trips.length - trips.indexOf(trip)).padStart(2, "0")}`;
  const flags = [...countries].map(flag).join(" ");
  const stubCodes = (trip.places.length > 3 ? [trip.places[0], trip.places[trip.places.length - 1]] : trip.places).map((p) => placeCode(p.name)).join(" · ");

  return (
    <section className="pass-page">
      <div className="page-head">
        <a className="back-link" href="#/trips">
          ← Trips
        </a>
        <button className="btn" onClick={() => setEditing(true)}>
          ✏️ Edit
        </button>
      </div>

      <Pass
        tone={`mode-${mode}`}
        photo={{ url: trip.cover_url, fallback: flags || "🧳" }}
        head={[
          `${m.icon} ${m.kind}`,
          <>
            PASS {passNo}
            {trip.start_date && <span className="desktop-only"> · {monthYear(trip.start_date).toUpperCase()}</span>}
          </>,
        ]}
        route={ends && { from: ends.from.name, to: ends.to.name, icon: m.icon }}
        title={trip.title}
        facts={[
          [WORDING[mode].went, shortRange(trip.start_date, trip.end_date) ?? "—"],
          ["NIGHTS", n ?? "—"],
          ...(people.length ? [["PASSENGERS", people.map((p) => p.name).join(" & ")] as [string, string]] : []),
          ["RATING", trip.rating ? <Stars value={trip.rating} /> : <span className="muted">Not rated</span>],
        ]}
        tags={
          <>
            <span className="detail">
              {m.icon} {MODES[mode].short}
            </span>
            {creator && (
              <span className="detail">
                <span className="dot" style={{ background: creator.color }} /> Added by {personName(trip.created_by)}
              </span>
            )}
            {idea && (
              <a className="detail" href={`#/ideas/${idea.id}`}>
                🏆 From the idea "{idea.title}"
              </a>
            )}
          </>
        }
        stub={[m.icon, stubCodes || m.kind, passNo]}
      />

      <div className="pass-columns">
        <div className="pass-left">
          {trip.notes && <p className="pass-notes">{trip.notes}</p>}
          {trip.places.length > 0 ? (
            <Board title={WORDING[mode].board} column={WORDING[mode].column} rows={boardRows(mode, trip.places)} />
          ) : (
            <p className="muted small">No places yet. Add some with Edit.</p>
          )}
        </div>
        {pins.length > 0 && (
          <div className="pass-map">
            <WorldMap visited={countries} ideas={NONE} pins={pins} routes={routes} selected={null} onSelect={() => {}} close />
          </div>
        )}
      </div>

      {editing && <TripForm trip={trip} onClose={() => setEditing(false)} onDeleted={() => (location.hash = "/trips")} />}
    </section>
  );
}
