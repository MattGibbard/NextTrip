import type { Terminal } from "../../shared/terminals";
import type { HotelCampaign } from "../../shared/hotels";
import { api } from "../api";
import { useFromOnceUp } from "../visitor";
import { flightLink } from "../../shared/flights";
import { hotelLink } from "../../shared/hotels";
import { activitiesLink } from "../../shared/activities";

/** What the booking links need to know about a place: a guide, or one a blog post is about. */
export interface BookPlace {
  name: string;
  country: string;
  country_code: string;
  lat: number | null;
  lon: number | null;
  /** The airport to fly into, if the guide names one. */
  to_code: string;
}

/**
 * Flights, hotels and things to do for one place, through our affiliate links. The flights leave from
 * the visitor's airport, which only changes once the page is up, so the prerendered page (searching
 * from London) and React agree. Two adults unless the family is signed in.
 */
export function BookCard({ place: d, campaign, airport = null, travellers }: { place: BookPlace; campaign: HotelCampaign; airport?: Terminal | null; travellers?: number }) {
  const from = useFromOnceUp(airport);
  const guests = travellers || 2;
  const place = { name: d.name, country: d.country, country_code: d.country_code, lat: d.lat, lon: d.lon };
  const flights = d.to_code && d.to_code !== from.code ? flightLink(from.code, d.to_code, guests, campaign, { currency: from.currency }) : null;
  const who = guests === 1 ? "1 traveller" : `${guests} travellers`;
  return (
    <section aria-labelledby="dg-book" className="dg-section dg-book">
      <h2 id="dg-book">Book {d.name}</h2>
      <div className="dg-book-links">
        {flights && <BookLink href={flights} kind="flights" campaign={campaign} title={`✈️ Flights ${from.code} to ${d.to_code}`} sub={`Any dates · ${who}`} />}
        <BookLink href={hotelLink(place, campaign, { guests, currency: from.currency })} kind="hotels" campaign={campaign} title={`🏨 Hotels in ${d.name}`} sub={`Any dates · ${who}`} />
        <BookLink href={activitiesLink(place, campaign)} kind="things" campaign={campaign} title={`🎟️ Things to do in ${d.name}`} sub="Tickets and tours" />
      </div>
      <Commission />
    </section>
  );
}

function BookLink({ href, kind, campaign, title, sub }: { href: string; kind: "flights" | "hotels" | "things"; campaign: HotelCampaign; title: string; sub: string }) {
  return (
    <a className="dg-book-link" href={href} target="_blank" rel="sponsored noopener" onClick={() => api.bookClick(kind, campaign)}>
      <span className="dg-book-text">
        <span>{title}</span>
        <span className="muted small">{sub}</span>
      </span>
      <span aria-hidden>↗</span>
    </a>
  );
}

/** The note that goes beside affiliate links. */
export function Commission() {
  return (
    <p className="muted small">
      We may earn a small commission if you book, at no extra cost to you. <a href="/how-we-make-money">How we make money</a>
    </p>
  );
}
