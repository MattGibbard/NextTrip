import type { Place } from "./types";
import type { HotelCampaign } from "./hotels";
import { TRAVELPAYOUTS_MARKER, TRAVELPAYOUTS_PROJECT } from "./flights";

/** Travelpayouts' own IDs for the Tiqets programme. */
const TIQETS = { p: "2074", campaign_id: "89" };

/**
 * A Tiqets search for attractions and activities in a place, through our Travelpayouts link so
 * bookings earn a commission. It searches by the place's name, and Tiqets sends a city it knows
 * on to its own attractions page (Rome lands on rome-attractions-c71631). No dates: Tiqets picks
 * them on the ticket itself.
 */
export function activitiesLink(place: Place, campaign: HotelCampaign): string {
  const search = new URL("https://www.tiqets.com/en/search");
  search.searchParams.set("q", place.name.trim());
  const q = new URLSearchParams({
    campaign_id: TIQETS.campaign_id,
    marker: TRAVELPAYOUTS_MARKER,
    p: TIQETS.p,
    trs: TRAVELPAYOUTS_PROJECT,
    sub_id: campaign,
    u: search.toString(),
  });
  return `https://tp.media/r?${q}`;
}
