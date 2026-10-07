import type { Place } from "../../shared/types";
import { hotelLink, hotelPlaces } from "../../shared/hotels";
import type { HotelCampaign } from "../../shared/hotels";

/** "Find hotels" buttons for each place, through our Stay22 affiliate link, with the commission note beside them. */
export function HotelLinks({ places, campaign, className = "" }: { places: Place[]; campaign: HotelCampaign; className?: string }) {
  const stops = hotelPlaces(places);
  if (stops.length === 0) return null;
  return (
    <section className={`hotel-links ${className}`.trim()} aria-labelledby={`hotels-${campaign}`}>
      <h2 id={`hotels-${campaign}`} className="mono-label">
        🏨 Where to stay
      </h2>
      <div className="hotel-buttons">
        {stops.map((p) => (
          <a key={`${p.name}|${p.country_code}`} className="btn ghost" href={hotelLink(p, campaign)} target="_blank" rel="sponsored noopener">
            Find hotels in {p.name}
            <span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      <p className="muted small hotel-note">We may earn a small commission if you book, at no extra cost to you.</p>
    </section>
  );
}
