// Cloudflare Turnstile, the bot check on the sign-in form. With the widget set to Invisible in the
// Cloudflare dashboard nothing shows; the box only appears if Cloudflare wants a visitor to tick it.
// The script loads only when someone starts signing in, so other pages don't pay for it.
import { api } from "./api";

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let siteKey: Promise<string | null> | null = null;
let script: Promise<Turnstile> | null = null;

function loadScript(): Promise<Turnstile> {
  script ??= new Promise<Turnstile>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't load")));
    el.onerror = () => reject(new Error("Turnstile didn't load"));
    document.head.append(el);
  }).catch((err) => {
    script = null;
    throw err;
  });
  return script;
}

/** Fetches the site key and the script ahead of time, for when someone starts typing their email. */
export function warmTurnstile() {
  siteKey ??= api.turnstileKey().then(
    (r) => r.site_key,
    () => {
      siteKey = null;
      return null;
    },
  );
  void siteKey.then((key) => {
    if (key) loadScript().catch(() => {});
  });
}

/**
 * A one-off token proving this is a person, or undefined when the check is switched off.
 * `box` is where Cloudflare can show its checkbox if it needs to.
 */
export async function turnstileToken(box: HTMLElement): Promise<string | undefined> {
  warmTurnstile();
  const key = await siteKey;
  if (!key) return undefined;
  const ts = await loadScript().catch(() => {
    throw new Error("We couldn't load the bot check. Check your connection, or turn off a blocker for this site, and try again.");
  });
  return new Promise<string>((resolve, reject) => {
    const id = ts.render(box, {
      sitekey: key,
      action: "sign-in",
      appearance: "interaction-only",
      callback: (token: string) => {
        resolve(token);
        setTimeout(() => ts.remove(id));
      },
      "error-callback": () => {
        reject(new Error("We couldn't check you're not a bot. Reload the page and try again."));
        setTimeout(() => ts.remove(id));
        return true;
      },
    });
  });
}
