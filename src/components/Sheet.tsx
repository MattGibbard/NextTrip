// The building blocks of the add and edit sheets for trips and ideas.
import type { ReactNode } from "react";
import type { Place } from "../../shared/types";
import { MODES, MODE_KEYS } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import { flag } from "../countries";
import { ModeIcon } from "./ModeIcon";
import { PlaceSearch } from "./PlaceSearch";
import { CrossIcon } from "./TerminalPicker";

/** What the map does with each way of travelling. */
export const MODE_HINT: Record<Mode, string> = {
  flight: "The map draws a dotted line from your departure airport to your arrival.",
  train: "Your places join up in order on the map, station to station.",
  cruise: "Your ports join up in order on the map, sailing from and back to your port.",
  road: "Your stops join up in order on the map, after the flight out.",
};

/** The pinned top of a sheet: a small mono line in the mode's colour over the heading, and a close button. */
export function SheetHead({ eyebrow, heading, onClose }: { eyebrow: string; heading: string; onClose: () => void }) {
  return (
    <header className="ts-head">
      <span className="ts-grabber mobile-only" aria-hidden />
      <div className="ts-head-row">
        <div className="ts-titles">
          <span className="mono-label mode-ink">{eyebrow}</span>
          <h2>{heading}</h2>
        </div>
        <button type="button" className="ts-close" onClick={onClose} aria-label="Close">
          <CrossIcon size={18} />
        </button>
      </div>
    </header>
  );
}

/** The pinned bottom of a sheet: Delete on the left when there is one, then Cancel and the save button. */
export function SheetFoot({ onDelete, onClose, saving, saveLabel }: { onDelete?: () => void; onClose: () => void; saving: boolean; saveLabel: string }) {
  return (
    <footer className="ts-foot">
      {onDelete && (
        <button type="button" className="ts-delete" onClick={onDelete}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
          <span>Delete</span>
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn ghost" onClick={onClose}>
        Cancel
      </button>
      <button className="btn" disabled={saving}>
        {saving ? "Saving…" : saveLabel}
      </button>
    </footer>
  );
}

/** The live card at the top of a sheet. */
export function SheetPreview({ children }: { children: ReactNode }) {
  return (
    <div className="ts-preview">
      <span className="mono-label muted">HOW IT WILL LOOK</span>
      {children}
    </div>
  );
}

/** A small mono heading with a rule running off to the right. */
export function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ts-section">
      <div className="ts-rule">
        <span className="mono-label">{title}</span>
        <span />
      </div>
      {children}
    </section>
  );
}

/** Fly, train, cruise or road trip, as four buttons with icons. */
export function ModePicker({ label, mode, onChange, hint }: { label: string; mode: Mode; onChange: (m: Mode) => void; hint: string }) {
  return (
    <div className="ts-field" role="radiogroup" aria-labelledby="ts-mode-label">
      <span className="field-label" id="ts-mode-label">
        {label}
      </span>
      <div className="ts-modes">
        {MODE_KEYS.map((k) => (
          <button type="button" key={k} role="radio" aria-checked={mode === k} className={`ts-mode mode-${k} ${mode === k ? "on" : ""}`} onClick={() => onChange(k)}>
            <ModeIcon mode={k} />
            <span>{MODES[k].short}</span>
          </button>
        ))}
      </div>
      <span className="muted small">{hint}</span>
    </div>
  );
}

/** Places as pills, joined by arrows when the order matters, with a search box to add more. */
export function PlacesField({ places, onChange, ordered, hint }: { places: Place[]; onChange: (p: Place[]) => void; ordered: boolean; hint: string }) {
  return (
    <div className="ts-field">
      <div className="ts-label-row">
        <span className="field-label">Places</span>
        <span className="muted small">{hint}</span>
      </div>
      {places.length > 0 && (
        <ul className="ts-places">
          {places.map((p, i) => (
            <li key={`${p.name}-${p.country_code}-${i}`}>
              {ordered && i > 0 && (
                <span className="ts-sep mode-ink" aria-hidden>
                  →
                </span>
              )}
              <span className="ts-place" title={`${p.name}, ${p.country}`}>
                <span>
                  {flag(p.country_code)} {p.name}
                </span>
                <button type="button" onClick={() => onChange(places.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>
                  <CrossIcon />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <PlaceSearch icon onAdd={(p) => onChange([...places, p])} placeholder={places.length ? "Add another place…" : "Search for a city…"} />
    </div>
  );
}
