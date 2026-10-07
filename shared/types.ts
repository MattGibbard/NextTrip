import type { RoundFilters } from "./roundFilters";
import type { Shortlist } from "./shortlist";
import type { HolidayType, TravelTime, TripLength } from "./ideaDetails";
import type { Terminal } from "./terminals";
import type { PhotoCredit } from "./photos";

export interface Person {
  id: number;
  name: string;
  color: string;
  /** Taken out of the family by the organiser. Still named on past draws. */
  removed: boolean;
}

/** Who this browser is signed in as. */
export type Session =
  | { signed_in: false }
  | {
      signed_in: true;
      /** owner: the organiser, who signed in by email. member: came in with the family link. */
      role: "owner" | "member";
      /** The family link's secret part. Only the organiser sees it. */
      share_token: string | null;
      /** Who this browser is, set when they join. Null until they've given their name. */
      person_id: number | null;
    };

export interface Place {
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2, upper case. */
  country_code: string;
  lat: number | null;
  lon: number | null;
}

export interface Trip {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  rating: number | null;
  cover_url: string | null;
  /** Set when the cover came from the photo suggestions. */
  cover_credit: PhotoCredit | null;
  /** Road trips draw their route city to city, in order. */
  road_trip: boolean;
  /** Cruises also draw their route port to port, in order. */
  cruise: boolean;
  /** Train journeys also go station to station, in order. */
  rail: boolean;
  /** The airport, station or port the trip set off from. */
  depart: Terminal | null;
  /** The airport or station it arrived at. Cruises have none. */
  arrive: Terminal | null;
  idea_id: number | null;
  created_by: number | null;
  created_at: string;
  places: Place[];
}

export type TripInput = Omit<Trip, "id" | "created_at">;

export type IdeaStatus = "active" | "won" | "done" | "archived";

export interface IdeaDetails {
  /** 1–3, shown as £ to £££. */
  budget: number | null;
  trip_length: TripLength | null;
  travel_time: TravelTime | null;
  holiday_types: HolidayType[];
}

export interface Idea extends IdeaDetails {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  /** Set when the cover came from the photo suggestions. */
  cover_credit: PhotoCredit | null;
  status: IdeaStatus;
  created_by: number | null;
  created_at: string;
  places: Place[];
  depart: Terminal | null;
  arrive: Terminal | null;
}

export interface IdeaInput extends IdeaDetails {
  title: string;
  description: string | null;
  cover_url: string | null;
  /** Set when the cover came from the photo suggestions. */
  cover_credit: PhotoCredit | null;
  created_by: number | null;
  places: Place[];
  depart: Terminal | null;
  arrive: Terminal | null;
}

export interface Allocation {
  person_id: number;
  idea_id: number;
  points: number;
}

export interface Round {
  id: number;
  name: string;
  points_per_person: number;
  status: "open" | "drawn";
  winner_idea_id: number | null;
  winning_ticket: number | null;
  total_tickets: number | null;
  created_at: string;
  drawn_at: string | null;
  /** Which ideas this round is limited to, chosen when it started. */
  filters: RoundFilters;
  /** Whether the round starts with everyone swiping to make a shortlist. */
  swipe: boolean;
  /** Fixed once everyone has swiped; until then (or without swiping) null. */
  shortlist: Shortlist | null;
  /** The viewing person's own swipes. Nobody sees anyone else's. */
  my_swipes: { idea_id: number; liked: boolean }[];
  /** People who still have ideas to swipe on, while the shortlist is being made. */
  swiping: number[];
  /** Person ids that have locked in their points. */
  locked: number[];
  /** Everyone's veto for this round (vetoes are public as soon as they're used). */
  vetoes: { person_id: number; idea_id: number }[];
  /**
   * Before the draw: only the viewing person's own allocations.
   * After the draw: everyone's.
   */
  allocations: Allocation[];
  /** Titles of every idea that received points, so history survives idea edits. */
  ideas: { id: number; title: string; status: IdeaStatus }[];
}

export interface GeocodeResult {
  label: string;
  place: Place;
}

/** Where travel times are measured from. */
export type Home = Place | null;

/** The airport and station new trips and ideas set off from unless you pick another. */
export interface HomeEnds {
  airport: Terminal | null;
  station: Terminal | null;
}
