import { publicPage } from "../shared/seo";

// Moving between the signed-in app and the Guides pages without loading the page again. The app and
// the guides are one React app, so a link between them only needs the address changing and a redraw.

/** A Guides page: the list of guides or one guide. */
export function isGuidePath(pathname: string): boolean {
  const page = publicPage(pathname);
  return page === "destinations" || !!page?.startsWith("destination:");
}

/** Pages the app can switch between in place. */
export function isAppPath(pathname: string): boolean {
  return pathname === "/" || isGuidePath(pathname);
}

/** Goes to another address in place. The app listens for popstate, the same as for the back button. */
export function navigate(url: string) {
  history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0 });
}

/**
 * Turns a click on a link to another app or Guides page into an in-place move. Leaves alone anything
 * the browser should handle: new tabs, other sites, downloads, and links that only change the hash.
 */
export function followInPlace(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !isAppPath(url.pathname) || !isAppPath(location.pathname)) return;
  if (url.pathname === location.pathname && url.search === location.search) return;
  e.preventDefault();
  navigate(url.pathname + url.search + url.hash);
}
