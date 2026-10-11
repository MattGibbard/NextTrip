import { DEFAULT_CURRENCY } from "./currency";
import type { HotelCampaign } from "./hotels";
import type { Terminal } from "./terminals";
import type { StayDates } from "./tripDates";

/** Our Travelpayouts partner ID (their "marker") and the somewhere.party project in their dashboard. */
export const TRAVELPAYOUTS_MARKER = "786925";
export const TRAVELPAYOUTS_PROJECT = "582749";
/** Travelpayouts' own IDs for the Aviasales programme. */
const AVIASALES = { p: "4114", campaign_id: "100" };

/**
 * An Aviasales search from one airport to another, through our Travelpayouts link so bookings
 * earn a commission. With dates it searches that return trip; without, it opens the search form
 * with the route filled in. Aviasales ignores a route without a passenger count, so it always gets
 * one (1 to 9, all as adults). Prices show in the family's currency.
 */
export function flightLink(
  from: string,
  to: string,
  passengers: number,
  campaign: HotelCampaign,
  { dates = null, currency = DEFAULT_CURRENCY }: { dates?: StayDates | null; currency?: string } = {},
): string {
  const adults = Math.min(9, Math.max(1, Math.round(passengers) || 1));
  // Aviasales' route code: FROM DDMM TO DDMM adults, e.g. LHR1207BCN19072. It works out the year itself.
  const ddmm = (d: string) => d.slice(8, 10) + d.slice(5, 7);
  const route = dates ? `${from}${ddmm(dates.start)}${to}${ddmm(dates.end)}${adults}` : `${from}${to}${adults}`;
  const search = `https://www.aviasales.com/?params=${route}&currency=${currency.toLowerCase()}`;
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
