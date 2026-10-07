import { useEffect, useState } from "react";
import type { Place } from "../../shared/types";
import type { Terminal } from "../../shared/terminals";
import { ideaMode } from "../../shared/travelMode";
import { hotelLink, hotelPlaces } from "../../shared/hotels";
import type { HotelCampaign } from "../../shared/hotels";
import { flightLink, flightOrigin } from "../../shared/flights";
import { api } from "../api";
import { useData } from "../data";

interface Trip {
  places: Place[];
  depart: Terminal | null;
  arrive: Terminal | null;
  holiday_types: string[];
}

/**
 * Where the flight search lands: the idea's arrival airport, otherwise the airport nearest its
 * first place, looked up on the server because the airport list is too big to ship to the browser.
 */
function useFlightDestination(trip: Trip): Terminal | null {
  const arrive = trip.arrive?.kind === "airport" && trip.arrive.code ? trip.arrive : null;
  const first = trip.places.find((p) => p.lat !== null && p.lon !== null);
  const [nearest, setNearest] = useState<{ key: string; airport: Terminal | null } | null>(null);
  const key = first ? `${first.lat},${first.lon}` : "";
  useEffect(() => {
    if (arrive || !first) return;
    let live = true;
    api
      .nearestAirport(first.lat!, first.lon!)
      .then((airport) => live && setNearest({ key, airport }))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrive, key]);
  return arrive ?? (nearest?.key === key ? nearest.airport : null);
}

/** "Find flights" and "Find hotels" buttons through our affiliate links, with the commission note beside them. */
export function BookLinks({ trip, campaign, className = "" }: { trip: Trip; campaign: HotelCampaign; className?: string }) {
  const { home } = useData();
  const mode = ideaMode(trip.holiday_types);
  const flies = mode === "flight" || mode === "road";
  const from = flies ? flightOrigin(trip.depart, home) : null;
  const to = useFlightDestination(trip);
  const flight = from?.code && to?.code && from.code !== to.code ? { from: from.code, to: to.code } : null;
  const stops = hotelPlaces(trip.places);
  if (!flight && stops.length === 0) return null;
  return (
    <section className={`book-links ${className}`.trim()} aria-labelledby={`book-${campaign}`}>
      <h2 id={`book-${campaign}`} className="mono-label">
        🧳 Book it
      </h2>
      <div className="book-buttons">
        {flight && (
          <a className="btn ghost" href={flightLink(flight.from, flight.to, campaign)} target="_blank" rel="sponsored noopener">
            ✈️ Find flights {flight.from} → {flight.to}
            <span aria-hidden>↗</span>
          </a>
        )}
        {stops.map((p) => (
          <a key={`${p.name}|${p.country_code}`} className="btn ghost" href={hotelLink(p, campaign)} target="_blank" rel="sponsored noopener">
            🏨 Find hotels in {p.name}
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      <p className="muted small book-note">We may earn a small commission if you book, at no extra cost to you.</p>
    </section>
  );
}
