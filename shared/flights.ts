import type { HotelCampaign } from "./hotels";
import type { Terminal } from "./terminals";

/** Our Travelpayouts partner ID (their "marker") and the somewhere.party project in their dashboard. */
export const TRAVELPAYOUTS_MARKER = "786925";
export const TRAVELPAYOUTS_PROJECT = "582749";
/** Travelpayouts' own IDs for the Aviasales programme. */
const AVIASALES = { p: "4114", campaign_id: "100" };

/**
 * An Aviasales search from one airport to another, through our Travelpayouts link so bookings
 * earn a commission. No dates yet: it opens the search form with the route filled in.
 */
export function flightLink(from: string, to: string, campaign: HotelCampaign): string {
  const search = `https://www.aviasales.com/?params=${from}${to}`;
  const q = new URLSearchParams({
    campaign_id: AVIASALES.campaign_id,
    marker: TRAVELPAYOUTS_MARKER,
    p: AVIASALES.p,
    trs: TRAVELPAYOUTS_PROJECT,
    sub_id: campaign,
    u: search,
  });
  return `https://tp.media/r?${q}`;
}

/** The airport an idea flies from: its own departure airport, otherwise the family's home airport. */
export function flightOrigin(depart: Terminal | null, home: Terminal | null): Terminal | null {
  if (depart?.kind === "airport" && depart.code) return depart;
  return home?.kind === "airport" && home.code ? home : null;
}
