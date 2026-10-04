import type { HolidayType, TravelTime, TripLength } from "./ideaDetails";

export interface Person {
  id: number;
  name: string;
  color: string;
}

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
  status: IdeaStatus;
  created_by: number | null;
  created_at: string;
  places: Place[];
}

export interface IdeaInput extends IdeaDetails {
  title: string;
  description: string | null;
  created_by: number | null;
  places: Place[];
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
