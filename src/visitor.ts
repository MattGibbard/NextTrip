import { useEffect, useState, useSyncExternalStore } from "react";
import { FROM_COOKIE, LONDON, fromTerminal, readHint } from "../shared/visitor";
import type { From } from "../shared/visitor";
import type { Terminal } from "../shared/terminals";

/**
 * Where the Worker reckons this visitor flies from, as it wrote it on the page (worker/visitor.ts).
 * None when the page is being built, in development, or for visitors it couldn't place.
 */
const EDGE: From | null = typeof document === "undefined" ? null : readHint(document.getElementById("root")?.dataset.visitor);

let current: From | null = EDGE;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/**
 * Where visitors fly from: the Worker's hint, then their own choice once they make one. While React
 * picks up the prerendered page it gets the hint the Worker drew that page for, so the two agree.
 */
export function useVisitor(): From | null {
  return useSyncExternalStore(subscribe, () => current, () => EDGE);
}

/** Where the visitor flies from right now, for code outside React. */
export function currentVisitor(): From | null {
  return current;
}

/**
 * Where the page's flight times are from: the family's home airport once it's known, otherwise the
 * visitor's, otherwise London. Words that use it go through <Geo>, so the Worker writes them too.
 */
export function useFrom(airport: Terminal | null | undefined): From {
  const visitor = useVisitor();
  return fromTerminal(airport) ?? visitor ?? LONDON;
}

/**
 * Like useFrom, but London until the page is up: for parts of a page the Worker can't rewrite, such as
 * which places count as near, so they match the prerendered page before changing.
 */
export function useFromOnceUp(airport: Terminal | null | undefined): From {
  const from = useFrom(airport);
  const [up, setUp] = useState(false);
  useEffect(() => setUp(true), []);
  return up ? from : LONDON;
}

/** The visitor's own "Flying from" choice, kept for a year so the Worker can use it next time. */
export function setFlyingFrom(from: From) {
  document.cookie = `${FROM_COOKIE}=${from.code}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`;
  current = from;
  listeners.forEach((fn) => fn());
}
