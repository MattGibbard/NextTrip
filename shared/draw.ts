import type { Allocation } from "./types";

export interface TicketRange {
  idea_id: number;
  tickets: number;
  /** First ticket number (1-based, inclusive). */
  from: number;
  /** Last ticket number (inclusive). */
  to: number;
}

/**
 * Sums every person's points per idea and lays the tickets out end to end,
 * in idea id order, so a ticket number maps to exactly one idea.
 */
export function ticketRanges(allocations: Allocation[]): TicketRange[] {
  const totals = new Map<number, number>();
  for (const a of allocations) {
    if (a.points > 0) totals.set(a.idea_id, (totals.get(a.idea_id) ?? 0) + a.points);
  }
  let next = 1;
  return [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([idea_id, tickets]) => {
      const range = { idea_id, tickets, from: next, to: next + tickets - 1 };
      next += tickets;
      return range;
    });
}

export function ideaForTicket(ranges: TicketRange[], ticket: number): number {
  const hit = ranges.find((r) => ticket >= r.from && ticket <= r.to);
  if (!hit) throw new Error(`Ticket ${ticket} is out of range`);
  return hit.idea_id;
}

/** Uniform integer in [1, max] with no modulo bias. */
export function randomTicket(max: number, random: (buf: Uint32Array) => void): number {
  if (!Number.isInteger(max) || max < 1) throw new Error("No tickets to draw from");
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    random(buf);
  } while (buf[0] >= limit);
  return (buf[0] % max) + 1;
}

/**
 * Checks one person's allocation for a round. Returns an error message, or
 * null when it is valid. `requireAll` is set when locking in.
 */
export function validateAllocation(
  entries: { idea_id: number; points: number }[],
  pointsPerPerson: number,
  activeIdeaIds: Set<number>,
  requireAll: boolean,
): string | null {
  let total = 0;
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isInteger(e.points) || e.points < 0) return "Points must be whole numbers";
    if (seen.has(e.idea_id)) return "Each idea can appear only once";
    seen.add(e.idea_id);
    if (e.points > 0 && !activeIdeaIds.has(e.idea_id)) return "That idea is no longer in the pool";
    total += e.points;
  }
  if (total > pointsPerPerson) return `You only have ${pointsPerPerson} points`;
  if (requireAll && total !== pointsPerPerson) {
    return `Spend all ${pointsPerPerson} points before locking in (${pointsPerPerson - total} left)`;
  }
  return null;
}

/**
 * The points that count in a draw: everything except points on vetoed ideas.
 * Vetoes are secret until the draw, so if they happen to knock out every
 * ticket they're ignored and all points count.
 */
export function countedAllocations(allocations: Allocation[], vetoedIdeaIds: Iterable<number>): Allocation[] {
  const vetoed = new Set(vetoedIdeaIds);
  const kept = allocations.filter((a) => !vetoed.has(a.idea_id));
  return kept.some((a) => a.points > 0) ? kept : allocations;
}

/** True when vetoes knocked out every ticket, so they were ignored for the draw. */
export function vetoesIgnored(allocations: Allocation[], vetoedIdeaIds: Iterable<number>): boolean {
  const vetoed = new Set(vetoedIdeaIds);
  const points = allocations.filter((a) => a.points > 0);
  return vetoed.size > 0 && points.length > 0 && points.every((a) => vetoed.has(a.idea_id));
}
