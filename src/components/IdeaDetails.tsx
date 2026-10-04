import type { IdeaDetails as Details } from "../../shared/types";
import {
  BUDGETS,
  HOLIDAY_TYPES,
  TRAVEL_TIMES,
  TRIP_LENGTHS,
  budgetLabel,
  holidayType,
  travelTimeLabel,
  tripLengthLabel,
} from "../../shared/ideaDetails";

/** Compact one-line summary: "££ · About a week · ✈️ 3–6h · 🏖️ 🍷". */
export function IdeaDetailsLine({ idea }: { idea: Details }) {
  const parts = [
    budgetLabel(idea.budget),
    tripLengthLabel(idea.trip_length),
    idea.travel_time ? `✈️ ${travelTimeLabel(idea.travel_time)}` : null,
  ].filter(Boolean);
  if (parts.length === 0 && idea.holiday_types.length === 0) return null;
  return (
    <div className="details-line">
      {parts.map((p) => (
        <span key={p} className="detail">
          {p}
        </span>
      ))}
      {idea.holiday_types.map((t) => {
        const ht = holidayType(t);
        return ht ? (
          <span key={t} className="detail" title={ht.label}>
            {ht.icon} {ht.label}
          </span>
        ) : null;
      })}
    </div>
  );
}

function ChoiceRow<K extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: K; label: string; hint?: string }[];
  value: K | null;
  onChange: (v: K | null) => void;
  label: string;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="choice-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            type="button"
            key={o.key}
            role="radio"
            aria-checked={value === o.key}
            className={`choice ${value === o.key ? "on" : ""}`}
            title={o.hint}
            onClick={() => onChange(value === o.key ? null : o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Editors for the practical details. Tapping a selected choice clears it. */
export function IdeaDetailsFields({ value, onChange }: { value: Details; onChange: (v: Details) => void }) {
  const toggleType = (k: Details["holiday_types"][number]) =>
    onChange({
      ...value,
      holiday_types: value.holiday_types.includes(k) ? value.holiday_types.filter((t) => t !== k) : [...value.holiday_types, k],
    });
  return (
    <>
      <ChoiceRow label="Budget" options={BUDGETS} value={value.budget} onChange={(budget) => onChange({ ...value, budget })} />
      <ChoiceRow label="Trip length" options={TRIP_LENGTHS} value={value.trip_length} onChange={(trip_length) => onChange({ ...value, trip_length })} />
      <ChoiceRow label="Travel time (each way)" options={TRAVEL_TIMES} value={value.travel_time} onChange={(travel_time) => onChange({ ...value, travel_time })} />
      <div className="field">
        <span>Type of holiday</span>
        <div className="choice-row">
          {HOLIDAY_TYPES.map((t) => (
            <button
              type="button"
              key={t.key}
              aria-pressed={value.holiday_types.includes(t.key)}
              className={`choice ${value.holiday_types.includes(t.key) ? "on" : ""}`}
              onClick={() => toggleType(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
