import type { Place } from "./types";
import type { StayDates } from "./tripDates";
import { DEFAULT_CURRENCY } from "./currency";

/** Our Stay22 affiliate ID. Bookings made through these links earn somewhere🎉 a commission. */
export const STAY22_AID = "somewhereparty";

/** Where the link was shown, so Stay22's reports say which button earned it. Underscores only, as Stay22 asks. */
export type HotelCampaign = "draw_result" | "idea_page" | "been_page" | "trip_plan" | "holiday_picker" | "destination_guide" | "blog";

/**
 * A Stay22 link that searches hotels in a place, on whichever booking site Stay22 picks.
 * It sends the place's name and country rather than its coordinates: Booking.com searches
 * by name reliably, but coordinates sometimes landed on the wrong city (Banff opened Munich).
 * With dates, the search opens for that check-in and check-out. It's for the whole family
 * (1 to 30, all as adults), with prices in the family's currency.
 */
export function hotelLink(
  place: Place,
  campaign: HotelCampaign,
  { dates = null, guests = 0, currency = DEFAULT_CURRENCY }: { dates?: StayDates | null; guests?: number; currency?: string } = {},
): string {
  const q = new URLSearchParams({ aid: STAY22_AID });
  const address = [place.name.trim(), place.country.trim()].filter(Boolean).join(", ");
  if (address) {
    q.set("address", address);
  } else if (place.lat !== null && place.lon !== null) {
    q.set("lat", String(place.lat));
    q.set("lng", String(place.lon));
  }
  if (dates) {
    q.set("checkin", dates.start);
    q.set("checkout", dates.end);
  }
  if (guests > 0) q.set("adults", String(Math.min(30, Math.round(guests))));
  q.set("currency", currency);
  q.set("campaign", campaign);
  return `https://www.stay22.com/allez/roam?${q}`;
}

/** The places worth a hotel search: named, without repeats, and no more than a handful. */
export function hotelPlaces(places: Place[], max = 4): Place[] {
  const seen = new Set<string>();
  return places
    .filter((p) => {
      const key = `${p.name.trim().toLowerCase()}|${p.country_code}`;
      if (!p.name.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}
