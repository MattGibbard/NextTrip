import type { CSSProperties } from "react";
import type { Trip } from "../../shared/types";
import { tripMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import { flagsOf } from "../countries";
import { cssUrl } from "../format";
import { postcardTilt, postmarkDate } from "../postcard";
import { ModeIcon } from "./ModeIcon";

type CardTrip = Pick<Trip, "title" | "start_date" | "places" | "cover_url" | "cruise" | "road_trip" | "rail"> & { id?: number };

/** The perforated stamp in the travel mode's colour, with the year on it. */
export function PostcardStamp({ mode, year, className = "" }: { mode: Mode; year: string | null; className?: string }) {
  return (
    <span className={`pc-stamp ${className}`} aria-hidden="true">
      <span className="pc-stamp-ink">
        <ModeIcon mode={mode} className="pc-stamp-icon" />
        {year && <span>{year}</span>}
      </span>
    </span>
  );
}

/** The round postmark: the first place, the month and the year. */
export function Postmark({ place, date, className = "" }: { place: string; date: string | null; className?: string }) {
  const when = postmarkDate(date);
  if (!when) return null;
  return (
    <span className={`pc-postmark ${className}`} aria-hidden="true">
      {place && <span className="pm-place">{place.toUpperCase()}</span>}
      <span className="pm-month">{when.month}</span>
      <span className="pm-year">{when.year}</span>
    </span>
  );
}

/**
 * One trip as the front of a postcard: the cover photo with a stamp, a postmark
 * and its name. In the list it opens the trip; a `preview` isn't a link and has
 * no tilt, for a trip that's still being filled in.
 */
export function TripPostcard({ trip, preview = false }: { trip: CardTrip; preview?: boolean }) {
  const mode = tripMode(trip);
  const flags = flagsOf(trip.places);
  const title = trip.title || "Your trip name";
  const when = postmarkDate(trip.start_date);
  const tilt = preview || trip.id === undefined ? 0 : postcardTilt(trip.id);
  const Tag = preview ? "div" : "a";

  return (
    <Tag className={`postcard mode-${mode}${preview ? " preview" : ""}`} href={preview ? undefined : `#/been/${trip.id}`} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <span className="pc-front">
        <span className={`pc-photo${trip.cover_url ? "" : " placeholder"}`} style={trip.cover_url ? { backgroundImage: cssUrl(trip.cover_url) } : undefined}>
          {!trip.cover_url && <span className="pc-flags">{flags || "🧳"}</span>}
          <span className="pc-shade" />
          {when && (
            <svg className="pc-waves" viewBox="0 0 64 26" aria-hidden="true">
              <path d="M0 5 Q8 1 16 5 T32 5 T48 5 T64 5 M0 13 Q8 9 16 13 T32 13 T48 13 T64 13 M0 21 Q8 17 16 21 T32 21 T48 21 T64 21" />
            </svg>
          )}
          <Postmark place={trip.places[0]?.name ?? ""} date={trip.start_date} />
          <PostcardStamp mode={mode} year={when?.year ?? null} />
          <span className="pc-greeting">
            <span className="pc-greet-label">GREETINGS FROM</span>
            <span className={`pc-front-title${trip.title ? "" : " unnamed"}`}>{title}</span>
          </span>
        </span>
      </span>
    </Tag>
  );
}
