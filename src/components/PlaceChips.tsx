import type { Place } from "../../shared/types";
import { flag } from "../countries";

export function PlaceChips({ places, onRemove }: { places: Place[]; onRemove?: (i: number) => void }) {
  if (places.length === 0) return null;
  return (
    <ul className="chips">
      {places.map((p, i) => (
        <li key={`${p.name}-${p.country_code}-${i}`} className="chip" title={`${p.name}, ${p.country}`}>
          <span>{flag(p.country_code)}</span> {p.name}
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${p.name}`}>
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
