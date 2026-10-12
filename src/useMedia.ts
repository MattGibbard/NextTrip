import { useEffect, useState } from "react";

/** Whether a CSS media query matches right now, kept up to date as it changes. */
export function useMedia(query: string) {
  const get = () => typeof matchMedia === "function" && matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(query);
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [query]);
  return on;
}
