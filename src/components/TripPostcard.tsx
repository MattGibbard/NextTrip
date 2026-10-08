import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Trip } from "../../shared/types";
import { MODES, placeCode, ticketEnds, tripMode } from "../../shared/travelMode";
import { useData } from "../data";
import { cssUrl, nights, shortRange } from "../format";
import { postcardTilt, postmarkDate, routeSketch } from "../postcard";
import type { SketchPoint } from "../postcard";
import { ModeIcon } from "./ModeIcon";
import { Stars } from "./Stars";
import { flagsOf } from "../countries";

type CardTrip = Pick<Trip, "title" | "start_date" | "end_date" | "places" | "rating" | "cover_url" | "depart" | "arrive" | "cruise" | "road_trip" | "rail"> & { id?: number };

const hasSpot = <T extends { lat: number | null; lon: number | null }>(p: T | null | undefined): p is T & { lat: number; lon: number } =>
  !!p && p.lat !== null && p.lon !== null;

function TurnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pc-turn-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/**
 * One trip as a postcard: the cover photo on the front, and the details and a
 * sketch of the route on the back. Tapping turns it over. A `preview` has no
 * link to the trip and no tilt, for a trip that's still being filled in.
 */
export function TripPostcard({ trip, passNo, preview = false }: { trip: CardTrip; passNo: number; preview?: boolean }) {
  const { home, people } = useData();
  const [flipped, setFlipped] = useState(false);
  const frontBtn = useRef<HTMLButtonElement>(null);
  const backBtn = useRef<HTMLButtonElement>(null);

  const mode = tripMode(trip);
  const ends = ticketEnds(mode, trip, home);
  const n = nights(trip.start_date, trip.end_date);
  const flags = flagsOf(trip.places);
  const title = trip.title || "Your trip name";
  const when = postmarkDate(trip.start_date);
  const stops = trip.places.filter(hasSpot);
  const postmark = (trip.places[0]?.name ?? "").toUpperCase();
  const tilt = preview || trip.id === undefined ? 0 : postcardTilt(trip.id);

  // The route: from the departure (or home, for a flight or a single place) through each place.
  const origin = hasSpot(trip.depart) ? trip.depart : (mode === "flight" || stops.length === 1) && hasSpot(home) ? home : null;
  const points: SketchPoint[] = [...(origin ? [origin] : []), ...stops].map((p) => ({ lat: p.lat, lon: p.lon }));
  if (ends && points.length > 1) {
    points[0].label = ends.from.code;
    // Flights and cruises arrive at the first place; trains and road trips run to the last.
    const to = origin && mode !== "train" ? 1 : points.length - 1;
    points[to].label = ends.to.code;
  } else if (points.length === 1) {
    points[0].label = ends?.to.code ?? placeCode(stops[0]?.name ?? origin?.name ?? "");
  }
  const sketch = routeSketch(points, mode === "flight" && !!origin);

  const turn = (toBack: boolean) => {
    setFlipped(toBack);
    // Keep focus on the card when the side you were on hides itself.
    requestAnimationFrame(() => (toBack ? backBtn : frontBtn).current?.focus({ preventScroll: true }));
  };

  return (
    <div className={`postcard mode-${mode}${flipped ? " flipped" : ""}${preview ? " preview" : ""}`} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <div className="pc-card">
        <div className="pc-front" inert={flipped}>
          <div className={`pc-photo${trip.cover_url ? "" : " placeholder"}`} style={trip.cover_url ? { backgroundImage: cssUrl(trip.cover_url) } : undefined}>
            {!trip.cover_url && <span className="pc-flags">{flags || "🧳"}</span>}
            <span className="pc-shade" />
            {when && (
              <>
                <svg className="pc-waves" viewBox="0 0 64 26" aria-hidden="true">
                  <path d="M0 5 Q8 1 16 5 T32 5 T48 5 T64 5 M0 13 Q8 9 16 13 T32 13 T48 13 T64 13 M0 21 Q8 17 16 21 T32 21 T48 21 T64 21" />
                </svg>
                <span className="pc-postmark" aria-hidden="true">
                  {postmark && <span className="pm-place">{postmark}</span>}
                  <span className="pm-month">{when.month}</span>
                  <span className="pm-year">{when.year}</span>
                </span>
              </>
            )}
            <span className="pc-stamp" aria-hidden="true">
              <span className="pc-stamp-ink">
                <ModeIcon mode={mode} className="pc-stamp-icon" />
                {when && <span>{when.year}</span>}
              </span>
            </span>
            <span className="pc-greeting">
              <span className="pc-greet-label">GREETINGS FROM</span>
              <span className={`pc-front-title${trip.title ? "" : " unnamed"}`}>{title}</span>
            </span>
            <span className="pc-turn-pill" aria-hidden="true">
              <TurnIcon />
              TURN OVER
            </span>
          </div>
          <button ref={frontBtn} type="button" className="pc-hit" aria-label={`Turn over the ${title} postcard`} onClick={() => turn(true)} />
        </div>

        <div className="pc-back" inert={!flipped}>
          <div className="pc-message">
            <div className="pc-route mode-ink">
              <ModeIcon mode={mode} className="pc-route-icon" />
              <span>{ends ? `${ends.from.code} → ${ends.to.code}` : MODES[mode].kind}</span>
            </div>
            <h3 className={`pc-title${trip.title ? "" : " muted"}`}>{title}</h3>
            <div className="pc-line muted">{shortRange(trip.start_date, trip.end_date) ?? "No dates yet"}</div>
            {trip.places.length > 0 && (
              <div className="pc-line pc-places">
                {flags} {trip.places.map((p) => p.name).join(mode === "flight" ? " · " : " → ")}
              </div>
            )}
            <div className="pc-meta">
              {trip.rating ? <Stars value={trip.rating} /> : null}
              {n && <span className="mono-label">{n} {n === 1 ? "NIGHT" : "NIGHTS"}</span>}
            </div>
            <div className="pc-actions">
              {!preview && trip.id !== undefined && (
                <a className="btn pc-open" href={`#/been/${trip.id}`}>
                  Open trip
                </a>
              )}
              <button ref={backBtn} type="button" className="btn ghost pc-back-btn" aria-label={`Turn the ${title} postcard back to the photo`} onClick={() => turn(false)}>
                <TurnIcon />
                Turn over
              </button>
            </div>
          </div>
          <span className="pc-divider" aria-hidden="true" />
          <div className="pc-address">
            <div className="pc-address-top">
              <span className="mono-label">Nº {String(passNo).padStart(2, "0")}</span>
              <span className="pc-mini-stamp" aria-hidden="true">
                <span className="pc-stamp-ink">{when ? `’${when.year.slice(2)}` : ""}</span>
                <span className="pc-mini-mark" />
              </span>
            </div>
            {sketch && (
              <div className="pc-map" aria-hidden="true">
                <svg viewBox="0 0 100 70" preserveAspectRatio="none">
                  <path d={sketch.d} vectorEffect="non-scaling-stroke" />
                </svg>
                {sketch.pins.map((p, i) => (
                  <span key={i}>
                    <span className={`pc-pin${i === 0 && origin ? " origin" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
                    {p.label && (
                      <span className={`pc-pin-label${p.x < 50 ? " right" : " left"}${p.y < 50 ? " below" : " above"}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                        {p.label}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            {people.length > 0 && <div className="pc-to">To {people.map((p) => p.name).join(" & ")}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
