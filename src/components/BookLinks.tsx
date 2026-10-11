import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Place } from "../../shared/types";
import type { Terminal } from "../../shared/terminals";
import type { Mode } from "../../shared/travelMode";
import { hotelLink, hotelPlaces } from "../../shared/hotels";
import type { HotelCampaign } from "../../shared/hotels";
import { flightLink, flightOrigin } from "../../shared/flights";
import { currencyFor } from "../../shared/currency";
import type { StayDates } from "../../shared/tripDates";
import { api } from "../api";
import { useData } from "../data";

/** An idea or a past trip: where it went and the airports it used. */
interface Journey {
  places: Place[];
  depart: Terminal | null;
  arrive: Terminal | null;
}

/**
 * Where the flight search lands: its arrival airport, otherwise the airport nearest its
 * first place, looked up on the server because the airport list is too big to ship to the browser.
 */
function useFlightDestination(trip: Journey): Terminal | null {
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
export function BookLinks({
  trip,
  mode,
  campaign,
  title = "🧳 Book it",
  className = "",
  dates = null,
  before,
}: {
  trip: Journey;
  mode: Mode;
  campaign: HotelCampaign;
  title?: string;
  className?: string;
  /** When the trip is, so the searches open on those dates. */
  dates?: StayDates | null;
  /** Shown under the heading, above the buttons. */
  before?: ReactNode;
}) {
  const { home, people } = useData();
  // Searches are for the whole family, priced in the currency where they live (their home airport's country).
  const currency = currencyFor(home?.country_code);
  const flies = mode === "flight" || mode === "road";
  const from = flies ? flightOrigin(trip.depart, home) : null;
  const to = useFlightDestination(trip);
  const flight = from?.code && to?.code && from.code !== to.code ? { from: from.code, to: to.code } : null;
  const stops = hotelPlaces(trip.places);
  if (!flight && stops.length === 0) return null;
  return (
    <section className={`book-links ${className}`.trim()} aria-labelledby={`book-${campaign}`}>
      <h2 id={`book-${campaign}`} className="mono-label">
        {title}
      </h2>
      {before}
      <div className="book-buttons">
        {flight && (
          <a className="btn ghost" href={flightLink(flight.from, flight.to, people.length, campaign, { dates, currency })} target="_blank" rel="sponsored noopener">
            ✈️ Find flights {flight.from} → {flight.to}
            <span aria-hidden>↗</span>
          </a>
        )}
        {stops.map((p) => (
          <a key={`${p.name}|${p.country_code}`} className="btn ghost" href={hotelLink(p, campaign, { dates, guests: people.length, currency })} target="_blank" rel="sponsored noopener">
            🏨 Find hotels in {p.name}
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      <p className="muted small book-note">
        We may earn a small commission if you book, at no extra cost to you. <a href="/how-we-make-money">How we make money</a>
      </p>
    </section>
  );
}
