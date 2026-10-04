/** The ideas a swipe round keeps, and which rule picked them. */
export interface Shortlist {
  ids: number[];
  /** both: everyone liked them. either: someone liked them. all: too few likes, so every idea stays in. */
  rule: "both" | "either" | "all";
}

export interface Swipe {
  person_id: number;
  idea_id: number;
  liked: boolean;
}

/** Ideas in the pool this person hasn't swiped on yet. */
export function unswiped(personId: number, pool: number[], swipes: Swipe[]): number[] {
  const seen = new Set(swipes.filter((s) => s.person_id === personId).map((s) => s.idea_id));
  return pool.filter((id) => !seen.has(id));
}

/**
 * Ideas everyone liked. A draw needs at least two ideas, so with fewer than
 * two mutual likes it falls back to ideas anyone liked, then to the whole pool.
 */
export function buildShortlist(pool: number[], people: number[], swipes: Swipe[]): Shortlist {
  const likes = (id: number) => people.filter((p) => swipes.some((s) => s.person_id === p && s.idea_id === id && s.liked)).length;
  const both = pool.filter((id) => likes(id) === people.length);
  if (both.length >= 2) return { ids: both, rule: "both" };
  const either = pool.filter((id) => likes(id) > 0);
  if (either.length >= 2) return { ids: either, rule: "either" };
  return { ids: pool, rule: "all" };
}

export function parseShortlist(raw: string | null): Shortlist | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Shortlist;
    return Array.isArray(v.ids) ? { ids: v.ids.filter((x) => Number.isInteger(x)), rule: v.rule ?? "both" } : null;
  } catch {
    return null;
  }
}
