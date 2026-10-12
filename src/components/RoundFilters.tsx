import { useRef, useState } from "react";
import { BUDGETS, HOLIDAY_TYPES, TRAVEL_TIMES, TRIP_LENGTHS } from "../../shared/ideaDetails";
import { NO_FILTERS, hasFilters } from "../../shared/roundFilters";
import type { RoundFilters } from "../../shared/roundFilters";

type Key = keyof RoundFilters;

const GROUPS: { key: Key; label: string; options: readonly { key: string | number; label: string; hint?: string; icon?: string }[] }[] = [
  { key: "budgets", label: "Budget", options: BUDGETS },
  { key: "trip_lengths", label: "Trip length", options: TRIP_LENGTHS },
  { key: "travel_times", label: "Travel time (each way)", options: TRAVEL_TIMES },
  { key: "holiday_types", label: "Type of holiday", options: HOLIDAY_TYPES },
];

const Chevron = ({ up }: { up?: boolean }) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

/**
 * "Which ideas are in?" on a new round. Folded away by default to a count of the ideas in,
 * with the filters a tap away; once narrowed, the picks show as pills.
 * Each group is a row of multi-select chips, and nothing picked in a group means "any".
 */
export function IdeasInPicker({ value, onChange, total, matching }: { value: RoundFilters; onChange: (f: RoundFilters) => void; total: number; matching: number }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const filtered = hasFilters(value);
  const tooFew = matching < 2;
  const picks = filterSummary(value);
  const allIn = `All ${total} ideas are in`;
  const someIn = `${matching} of ${total} ideas ${matching === 1 ? "is" : "are"} in`;

  const toggle = (group: Key, key: string | number) => {
    const list = value[group] as (string | number)[];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({ ...value, [group]: next });
  };
  // The open and closed views swap buttons, so focus follows to the one that takes its place.
  const show = (o: boolean) => {
    setOpen(o);
    requestAnimationFrame(() => (o ? doneRef : toggleRef).current?.focus());
  };

  if (!open) {
    return (
      <div className="ideas-in ideas-pick">
        <div className="ip-summary">
          <div className="ip-summary-text">
            <span className={`ip-count ${tooFew ? "warn" : ""}`} aria-hidden="true">
              {matching}
            </span>
            <div>
              <h3>{filtered ? someIn : allIn}</h3>
              {filtered ? (
                <ul className="ip-pills" aria-label="Filters on">
                  {picks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Looking for something specific? Filter by budget, length, travel time or type.</p>
              )}
              {tooFew && <p className="small error-text">You need at least 2 ideas to start a round.</p>}
            </div>
          </div>
          <div className="ip-actions">
            {filtered && (
              <button type="button" className="btn plain" onClick={() => onChange(NO_FILTERS)}>
                Clear
              </button>
            )}
            <button ref={toggleRef} type="button" className="btn ghost ip-toggle" aria-expanded="false" onClick={() => show(true)}>
              {filtered ? "Change" : "Narrow it down"}
              <Chevron />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ideas-in ideas-pick" id="idea-filters">
      <div className="ip-head">
        <div>
          <h3>Which ideas are in?</h3>
          <p className="muted small">Pick any that fit. A row left empty means anything goes.</p>
        </div>
        <button ref={doneRef} type="button" className="btn ghost ip-toggle" aria-expanded="true" aria-controls="idea-filters" onClick={() => show(false)}>
          Done
          <Chevron up />
        </button>
      </div>
      {GROUPS.map((g) => {
        const picked = value[g.key] as (string | number)[];
        const id = `ip-${g.key}`;
        return (
          <div className="ip-group" key={g.key}>
            <div className="ip-label">
              <div id={id}>{g.label}</div>
              <div className="muted">{picked.length ? `${picked.length} picked` : "Any"}</div>
            </div>
            <div className="choice-row" role="group" aria-labelledby={id}>
              {g.options.map((o) => {
                const on = picked.includes(o.key);
                return (
                  <button type="button" key={o.key} aria-pressed={on} className={`choice ${on ? "on" : ""}`} title={o.hint} onClick={() => toggle(g.key, o.key)}>
                    {o.icon && <span aria-hidden="true">{o.icon}</span>}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="ip-foot">
        <p className={tooFew ? "error-text" : "ip-match"} aria-live="polite">
          {matching === 0
            ? "No ideas match. Try taking a filter off."
            : tooFew
              ? "Only 1 idea matches. You need at least 2 to start a round."
              : filtered
                ? `${matching} of ${total} ideas match`
                : allIn}
        </p>
        <button type="button" className="btn plain" onClick={() => onChange(NO_FILTERS)} disabled={!filtered}>
          Clear all
        </button>
      </div>
    </div>
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
