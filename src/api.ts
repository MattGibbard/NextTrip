import type { GeocodeResult, Home, HomeEnds, Idea, IdeaInput, Person, Round, Session, Trip, TripInput } from "../shared/types";
import type { RoundFilters } from "../shared/roundFilters";
import type { TerminalSearchResult } from "../shared/terminals";

let currentPerson: number | null = null;

export function setApiPerson(id: number | null) {
  currentPerson = id;
}

let onSignedOut = () => {};

/** Called when the server says this browser isn't signed in any more. */
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (currentPerson !== null) headers["X-Person-Id"] = String(currentPerson);
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new Error(navigator.onLine ? "Couldn't reach NextTrip. Check your connection." : "You're offline. Connect to the internet to load your trips.");
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) onSignedOut();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  session: () => request<Session>("GET", "/auth/me"),
  sendSignInEmail: (email: string) => request<{ ok: true; dev_link?: string }>("POST", "/auth/email", { email }),
  verifySignIn: (token: string) => request("POST", "/auth/verify", { token }),
  join: (token: string) => request("POST", "/auth/join", { token }),
  signOut: () => request("POST", "/auth/logout"),
  deleteAccount: (confirm: string) => request("DELETE", "/family", { confirm }),
  resetShareLink: () => request<{ share_token: string }>("POST", "/family/share-link"),

  people: () => request<Person[]>("GET", "/people"),
  addPerson: (p: { name: string; color: string }) => request<{ id: number }>("POST", "/people", p),
  updatePerson: (id: number, p: { name: string; color: string }) => request("PUT", `/people/${id}`, p),
  removePerson: (id: number) => request("DELETE", `/people/${id}`),

  trips: () => request<Trip[]>("GET", "/trips"),
  createTrip: (t: TripInput) => request<{ id: number }>("POST", "/trips", t),
  updateTrip: (id: number, t: TripInput) => request("PUT", `/trips/${id}`, t),
  deleteTrip: (id: number) => request("DELETE", `/trips/${id}`),

  ideas: () => request<Idea[]>("GET", "/ideas"),
  createIdea: (i: IdeaInput) => request<{ id: number }>("POST", "/ideas", i),
  updateIdea: (id: number, i: IdeaInput) => request("PUT", `/ideas/${id}`, i),
  deleteIdea: (id: number) => request("DELETE", `/ideas/${id}`),

  rounds: () => request<Round[]>("GET", "/rounds"),
  createRound: (r: { name?: string; points_per_person: number; filters?: RoundFilters; swipe?: boolean }) => request<{ id: number }>("POST", "/rounds", r),
  deleteRound: (id: number) => request("DELETE", `/rounds/${id}`),
  swipe: (id: number, idea_id: number, liked: boolean) => request("PUT", `/rounds/${id}/swipes`, { idea_id, liked }),
  home: () => request<Home>("GET", "/home"),
  setHome: (home: Home) => request("PUT", "/home", { home }),
  homeEnds: () => request<HomeEnds>("GET", "/home-ends"),
  setHomeEnds: (ends: Partial<HomeEnds>) => request("PUT", "/home-ends", ends),
  saveAllocations: (id: number, allocations: { idea_id: number; points: number }[]) =>
    request("PUT", `/rounds/${id}/allocations`, { allocations }),
  lock: (id: number) => request("POST", `/rounds/${id}/lock`),
  unlock: (id: number) => request("DELETE", `/rounds/${id}/lock`),
  veto: (id: number, idea_id: number) => request("POST", `/rounds/${id}/veto`, { idea_id }),
  unveto: (id: number) => request("DELETE", `/rounds/${id}/veto`),
  draw: (id: number) => request<Round>("POST", `/rounds/${id}/draw`),

  geocode: (q: string) => request<GeocodeResult[]>("GET", `/geocode?q=${encodeURIComponent(q)}`),
  terminals: (kind: "airport" | "station", q: string) => request<TerminalSearchResult[]>("GET", `/terminals?kind=${kind}&q=${encodeURIComponent(q)}`),
};
