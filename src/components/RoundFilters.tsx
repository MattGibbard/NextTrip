import { BUDGETS, HOLIDAY_TYPES, TRAVEL_TIMES, TRIP_LENGTHS } from "../../shared/ideaDetails";
import { hasFilters } from "../../shared/roundFilters";
import type { RoundFilters } from "../../shared/roundFilters";

type Key = keyof RoundFilters;

const GROUPS: { key: Key; label: string; options: readonly { key: string | number; label: string; hint?: string; icon?: string }[] }[] = [
  { key: "budgets", label: "Budget", options: BUDGETS },
  { key: "trip_lengths", label: "Trip length", options: TRIP_LENGTHS },
  { key: "travel_times", label: "Travel time (each way)", options: TRAVEL_TIMES },
  { key: "holiday_types", label: "Type of holiday", options: HOLIDAY_TYPES },
];

/** Multi-select chips for each detail. Nothing picked in a group means "any". */
export function RoundFilterFields({ value, onChange }: { value: RoundFilters; onChange: (f: RoundFilters) => void }) {
  const toggle = (group: Key, key: string | number) => {
    const list = value[group] as (string | number)[];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({ ...value, [group]: next });
  };
  return (
    <>
      {GROUPS.map((g) => (
        <div className="field" key={g.key}>
          <span>
            {g.label} {value[g.key].length === 0 && <span className="muted small">· any</span>}
          </span>
          <div className="choice-row">
            {g.options.map((o) => {
              const on = (value[g.key] as (string | number)[]).includes(o.key);
              return (
                <button type="button" key={o.key} aria-pressed={on} className={`choice ${on ? "on" : ""}`} title={o.hint} onClick={() => toggle(g.key, o.key)}>
                  {o.icon ? `${o.icon} ` : ""}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** One line per round, e.g. "£ or ££ · Beach or City break". */
export function filterSummary(f: RoundFilters): string[] {
  return GROUPS.flatMap((g) => {
    const picked = g.options.filter((o) => (f[g.key] as (string | number)[]).includes(o.key));
    return picked.length ? [picked.map((o) => (o.icon ? `${o.icon} ${o.label}` : o.label)).join(" or ")] : [];
  });
}

export function RoundFilterLine({ filters }: { filters: RoundFilters | undefined }) {
  if (!filters || !hasFilters(filters)) return null;
  return (
    <div className="details-line round-filters">
      <span className="muted small">Only:</span>
      {filterSummary(filters).map((s) => (
        <span key={s} className="detail">
          {s}
        </span>
      ))}
    </div>
  );
}
