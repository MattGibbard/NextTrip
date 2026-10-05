import { load, save } from "./storage";

/** Follow the device, or always light or dark. Kept per browser, like who you are. */
export type ThemeChoice = "system" | "light" | "dark";

const dark = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

export function themeChoice(): ThemeChoice {
  const c = load<ThemeChoice>("theme", "system");
  return c === "light" || c === "dark" ? c : "system";
}

/** Sets data-theme on the page, which the stylesheet's colours follow. index.html does the same before first paint. */
function apply(choice: ThemeChoice) {
  const isDark = choice === "dark" || (choice === "system" && !!dark?.matches);
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#18201d" : "#ffffff");
}

export function setThemeChoice(choice: ThemeChoice) {
  save("theme", choice);
  apply(choice);
}

dark?.addEventListener("change", () => apply(themeChoice()));
apply(themeChoice());
