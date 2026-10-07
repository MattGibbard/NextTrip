import type { Place } from "./types";

/** Our Stay22 affiliate ID. Bookings made through these links earn somewhere🎉 a commission. */
export const STAY22_AID = "somewhereparty";

/** Where the link was shown, so Stay22's reports say which button earned it. Underscores only, as Stay22 asks. */
export type HotelCampaign = "draw_result" | "idea_page";

/**
 * A Stay22 link that searches hotels in a place, on whichever booking site Stay22 picks.
 * It sends the place's name and country rather than its coordinates: Booking.com searches
 * by name reliably, but coordinates sometimes landed on the wrong city (Banff opened Munich).
 */
export function hotelLink(place: Place, campaign: HotelCampaign): string {
  const q = new URLSearchParams({ aid: STAY22_AID });
  const address = [place.name.trim(), place.country.trim()].filter(Boolean).join(", ");
  if (address) {
    q.set("address", address);
  } else if (place.lat !== null && place.lon !== null) {
    q.set("lat", String(place.lat));
    q.set("lng", String(place.lon));
  }
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
