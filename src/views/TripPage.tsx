import { useMemo, useState } from "react";
import type { Place } from "../../shared/types";
import type { Terminal } from "../../shared/terminals";
import { MODES, ticketEnds, tripMode } from "../../shared/travelMode";
import { BookLinks } from "../components/BookLinks";
import type { Mode } from "../../shared/travelMode";
import { useData } from "../data";
import { flag } from "../countries";
import { cssUrl, nights, shortRange } from "../format";
import { Stars } from "../components/Stars";
import { ModeIcon } from "../components/ModeIcon";
import { PostcardStamp, Postmark } from "../components/TripPostcard";
import { WorldMap, terminalPins } from "../components/WorldMap";
import { journeyLegs } from "../../shared/terminals";
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

function boardRows(mode: Mode, places: Place[], depart: Terminal | null) {
  const [first, middle, last] = WORDING[mode].notes;
  // A cruise with its port set leaves from and comes back to the port, so every place is a stop ashore.
  if (mode === "cruise" && depart) {
    const port = { label: `${flag(depart.country_code)} ${depart.name}`, lit: true };
    return [{ ...port, note: first }, ...places.map((p) => ({ label: `${flag(p.country_code)} ${p.name}`, note: middle, lit: false })), { ...port, note: last }];
  }
  return places.map((p, i) => {
    const note = places.length === 1 ? "VISITED" : i === 0 ? first : i === places.length - 1 ? last : middle;
    return { label: `${flag(p.country_code)} ${p.name}`, note, lit: places.length > 1 && (i === 0 || i === places.length - 1) && mode !== "flight" };
  });
}

/** Everything about one trip, laid out as the back of its postcard. */
export function TripPage({ id }: { id: number }) {
  const { trips, ideas, people, personName, home } = useData();
  const trip = trips.find((t) => t.id === id);
  const [editing, setEditing] = useState(false);
  const mode = trip ? tripMode(trip) : "flight";

  const countries = useMemo(() => new Set(trip?.places.map((p) => p.country_code) ?? []), [trip]);
  const pins = useMemo<Pin[]>(
    () => [
      ...(trip?.places ?? []).flatMap((p) =>
        p.lat !== null && p.lon !== null ? [{ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "visited" as const, colorVar: `--${mode}-ink` }] : [],
      ),
      ...(trip ? terminalPins([trip.depart, trip.arrive], "visited", `--${mode}-ink`) : []),
    ],
    [trip, mode],
  );
  const routes = useMemo<Route[]>(
    () =>
      trip
        ? [
            {
              places: trip.places,
              inOrder: mode !== "flight",
              label: trip.title,
              kind: "visited",
              colorVar: `--${mode}-ink`,
              journey: journeyLegs(mode, trip.depart, trip.arrive, trip.places),
            },
          ]
        : [],
    [trip, mode],
  );

  if (!trip) {
    return (
      <section>
        <a className="back-link" href="#/been">
          ← Been
        </a>
        <p className="muted center">This trip has been deleted.</p>
      </section>
    );
  }

  const m = MODES[mode];
  const creator = people.find((p) => p.id === trip.created_by);
  const idea = ideas.find((i) => i.id === trip.idea_id);
  const ends = ticketEnds(mode, trip, home);
  const n = nights(trip.start_date, trip.end_date);
  // Postcards count up from the oldest trip; trips arrive newest first.
  const cardNo = `Nº ${String(trips.length - trips.indexOf(trip)).padStart(2, "0")}`;
  const flags = [...countries].map(flag).join(" ");
  const year = trip.start_date?.slice(0, 4) ?? null;

  return (
    <section className="pass-page postcard-page">
      <div className="page-head">
        <a className="back-link" href="#/been">
          ← Been
        </a>
        <button className="btn" onClick={() => setEditing(true)}>
          ✏️ Edit
        </button>
      </div>

      <article className={`pcb mode-${mode}`}>
        <div className="pcb-message">
          {trip.cover_url ? (
            <div className="pcb-photo" style={{ backgroundImage: cssUrl(trip.cover_url) }} role="img" aria-label={`Cover photo for ${trip.title}`} />
          ) : null}
          <div className="pcb-route mode-ink">
            <ModeIcon mode={mode} className="pcb-route-icon" />
            <span>{ends ? `${ends.from.code} → ${ends.to.code}` : m.kind}</span>
          </div>
          <h1 className="pcb-title">{trip.title}</h1>
          <div className="pcb-facts">
            <span>{shortRange(trip.start_date, trip.end_date) ?? "No dates yet"}</span>
            {n && <span className="mono-label">{n} {n === 1 ? "NIGHT" : "NIGHTS"}</span>}
            {trip.rating ? <Stars value={trip.rating} /> : <span className="muted">Not rated</span>}
          </div>
          {trip.places.length > 0 && (
            <p className="pcb-places">
              {flags} {trip.places.map((p) => p.name).join(mode === "flight" ? " · " : " → ")}
            </p>
          )}
          {trip.notes ? <p className="pcb-notes">{trip.notes}</p> : <p className="pcb-notes muted">No notes yet. Write what you remember with Edit.</p>}
          {(creator || idea) && (
            <div className="pass-tags">
              {creator && (
                <span className="detail">
                  <span className="dot" style={{ background: creator.color }} /> Added by {personName(trip.created_by)}
                </span>
              )}
              {idea && (
                <a className="detail" href={`#/next/${idea.id}`}>
                  🏆 From the idea "{idea.title}"
                </a>
              )}
            </div>
          )}
        </div>

        <span className="pcb-divider" aria-hidden="true" />

        <div className="pcb-address">
          <div className="pcb-address-top">
            <span className="mono-label muted">{cardNo}</span>
            <span className="pcb-marks">
              <Postmark place={trip.places[0]?.name ?? ""} date={trip.start_date} className="ink" />
              <PostcardStamp mode={mode} year={year} />
            </span>
          </div>
          {pins.length > 0 && (
            <div className="pcb-map">
              <WorldMap visited={countries} ideas={NONE} pins={pins} routes={routes} selected={null} onSelect={() => {}} close />
            </div>
          )}
          {people.length > 0 && <div className="pcb-line pcb-to">To {people.map((p) => p.name).join(" & ")}</div>}
          {trip.places.length > 0 ? (
            <ol className="pcb-stops" aria-label={WORDING[mode].board.toLowerCase()}>
              {boardRows(mode, trip.places, trip.depart).map((r, i) => (
                <li key={i} className="pcb-line">
                  <span className="pcb-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ellipsis">{r.label}</span>
                  <span className={`pcb-note${r.lit ? " lit" : ""}`}>{r.note}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">No places yet. Add some with Edit.</p>
          )}
        </div>
      </article>

      <BookLinks trip={trip} mode={mode} campaign="been_page" title="🔁 Go again?" className="panel" />

      {editing && <TripForm trip={trip} onClose={() => setEditing(false)} onDeleted={() => (location.hash = "/been")} />}
    </section>
  );
}
