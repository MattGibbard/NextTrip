import { useEffect, useState } from "react";
import type { Person } from "../shared/types";
import { api } from "./api";
import { LAST_ME } from "./components/AppSkeleton";
import { SIGNED_IN, forgetFamily } from "./lastFamily";
import { load } from "./storage";

export interface SignedIn {
  signedIn: boolean;
  /** Who's using this device, for the header's name chip, as the app last saw them. */
  me: Pick<Person, "name" | "color"> | null;
}

// One check with the server however many parts of the page ask.
let check: Promise<boolean> | null = null;

/**
 * On the public pages (the blog, the holiday picker, How it works…): whether a family is signed in on this
 * browser, so they get the app's header rather than "Sign in". Starts signed out, the same as the prerendered
 * page, and only asks the server when this browser was signed in last time, so visitors fetch nothing.
 */
export function useSignedIn(): SignedIn {
  const [state, setState] = useState<SignedIn>({ signedIn: false, me: null });
  useEffect(() => {
    if (!load(SIGNED_IN, false)) return;
    let live = true;
    setState({ signedIn: true, me: load<SignedIn["me"]>(LAST_ME, null) });
    // Offline, trust last time rather than flicking back to the visitors' header.
    check ??= api
      .session()
      .then((s) => s.signed_in)
      .catch(() => true);
    void check.then((ok) => {
      if (ok) return;
      forgetFamily();
      if (live) setState({ signedIn: false, me: null });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
