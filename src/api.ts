import type { GeocodeResult, Idea, IdeaInput, Person, Round, Trip, TripInput } from "../shared/types";

let currentPerson: number | null = null;

export function setApiPerson(id: number | null) {
  currentPerson = id;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (currentPerson !== null) headers["X-Person-Id"] = String(currentPerson);
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  people: () => request<Person[]>("GET", "/people"),
  updatePerson: (id: number, p: { name: string; color: string }) => request("PUT", `/people/${id}`, p),

  trips: () => request<Trip[]>("GET", "/trips"),
  createTrip: (t: TripInput) => request<{ id: number }>("POST", "/trips", t),
  updateTrip: (id: number, t: TripInput) => request("PUT", `/trips/${id}`, t),
  deleteTrip: (id: number) => request("DELETE", `/trips/${id}`),

  ideas: () => request<Idea[]>("GET", "/ideas"),
  createIdea: (i: IdeaInput) => request<{ id: number }>("POST", "/ideas", i),
  updateIdea: (id: number, i: IdeaInput) => request("PUT", `/ideas/${id}`, i),
  deleteIdea: (id: number) => request("DELETE", `/ideas/${id}`),

  rounds: () => request<Round[]>("GET", "/rounds"),
  createRound: (r: { name?: string; points_per_person: number }) => request<{ id: number }>("POST", "/rounds", r),
  deleteRound: (id: number) => request("DELETE", `/rounds/${id}`),
  saveAllocations: (id: number, allocations: { idea_id: number; points: number }[]) =>
    request("PUT", `/rounds/${id}/allocations`, { allocations }),
  lock: (id: number) => request("POST", `/rounds/${id}/lock`),
  unlock: (id: number) => request("DELETE", `/rounds/${id}/lock`),
  veto: (id: number, idea_id: number) => request("POST", `/rounds/${id}/veto`, { idea_id }),
  unveto: (id: number) => request("DELETE", `/rounds/${id}/veto`),
  draw: (id: number) => request<Round>("POST", `/rounds/${id}/draw`),

  geocode: (q: string) => request<GeocodeResult[]>("GET", `/geocode?q=${encodeURIComponent(q)}`),
};
