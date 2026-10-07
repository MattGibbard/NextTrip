import type { Trip } from "../../shared/types";
import { MODES, ticketEnds, tripMode } from "../../shared/travelMode";
import { useData } from "../data";
import { flag } from "../countries";
import { nights, shortRange } from "../format";
import { Stars } from "./Stars";
import { Photo } from "./Ticket";

export const flagsOf = (places: { country_code: string }[]) => [...new Set(places.map((p) => p.country_code))].map(flag).join(" ");

type TicketTrip = Pick<Trip, "title" | "start_date" | "end_date" | "places" | "rating" | "cover_url" | "depart" | "arrive" | "cruise" | "road_trip" | "rail"> & { id?: number };

/** One trip as a ticket in the list. A `preview` isn't a link, for showing a trip that's still being filled in. */
export function TripTicket({ trip, passNo, preview = false }: { trip: TicketTrip; passNo: number; preview?: boolean }) {
  const { home } = useData();
  const mode = tripMode(trip);
  const m = MODES[mode];
  const ends = ticketEnds(mode, trip, home);
  const n = nights(trip.start_date, trip.end_date);
  const flags = flagsOf(trip.places);
  const ordered = mode !== "flight";
  const Tag = preview ? "div" : "a";
  return (
    <Tag className={`ticket mode-${mode}${preview ? " preview" : ""}`} href={preview ? undefined : `#/trips/${trip.id}`}>
      <Photo url={trip.cover_url} fallback={flags || "🧳"} className="ticket-photo" />
      <div className="ticket-body">
        <div className="ticket-top">
          <span className="mode-ink">
            {m.icon} {ends ? `${ends.from.code} → ${ends.to.code}` : m.kind}
          </span>
          {n && <span className="muted desktop-only">{n} NIGHTS</span>}
        </div>
        <div className={`ticket-title ${trip.title ? "" : "muted"}`}>{trip.title || "Your trip name"}</div>
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
    </Tag>
  );
}
