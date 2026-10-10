import type { FamilyData, Session } from "../shared/types";
import { LAST_ME } from "./components/AppSkeleton";
import { forget, load, save } from "./storage";

// Remembers whether this browser was signed in last time, so the home page isn't shown to people who
// are about to land in the app. index.html reads the same key before the first paint.
export const SIGNED_IN = "signedIn";

// The family's things as last loaded, so the app opens straight away with them and then quietly
// brings them up to date. Only kept while signed in on this browser.
const LAST_FAMILY = "lastFamily";
// Bump when FamilyData changes shape, so an old copy is never shown by newer code.
const VERSION = 1;

export type SignedInSession = Extract<Session, { signed_in: true }>;

export interface LastFamily {
  session: SignedInSession;
  data: FamilyData;
}

export function lastFamily(): LastFamily | null {
  const saved = load<(LastFamily & { v: number }) | null>(LAST_FAMILY, null);
  if (saved?.v !== VERSION || !saved.session?.signed_in || !saved.data) return null;
  return { session: saved.session, data: saved.data };
}

export function rememberFamily(last: LastFamily) {
  save(LAST_FAMILY, { v: VERSION, ...last });
}

/** About to sign in with a link, perhaps as someone else, so last time's things mustn't show. */
export function forgetFamilyData() {
  forget(LAST_FAMILY);
}

/** Signed out: nothing of the family stays on this browser. */
export function forgetFamily() {
  save(SIGNED_IN, false);
  forget(LAST_ME);
  forgetFamilyData();
}
