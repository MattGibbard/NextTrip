import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Place, Trip, TripInput } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { flag } from "../countries";
import { cssUrl } from "../format";
import { Modal } from "../components/Modal";
import { ModeIcon } from "../components/ModeIcon";
import { PlaceSearch } from "../components/PlaceSearch";
import { CrossIcon, JourneyCards, useJourney } from "../components/TerminalPicker";
import { TripTicket } from "../components/TripTicket";
import { MODES, MODE_KEYS, ideaMode, modeFlags, tripMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import type { Terminal } from "../../shared/terminals";

export interface TripDraft {
  title?: string;
  places?: Place[];
  idea_id?: number | null;
  depart?: Terminal | null;
  arrive?: Terminal | null;
}

const MODE_HINT: Record<Mode, string> = {
  flight: "The map draws a dotted line from your departure airport to your arrival.",
  train: "Your places join up in order on the map, station to station.",
  cruise: "Your ports join up in order on the map, sailing from and back to your port.",
  road: "Your stops join up in order on the map, after the flight out.",
};

const RATING_WORDS = ["Not rated yet", "Not for us", "It was OK", "Good", "Really good", "Loved it"];

/** A small mono heading with a rule running off to the right. */
function Section({ title, children }: { title: string; children: ReactNode }) {
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

export function TripForm({ trip, draft, onClose, onDeleted }: { trip?: Trip; draft?: TripDraft; onClose: () => void; onDeleted?: () => void }) {
  const { me, reload, ideas, trips, isOwner } = useData();
  const fromIdea = ideas.find((i) => i.id === draft?.idea_id);
  const [title, setTitle] = useState(trip?.title ?? draft?.title ?? "");
  const [start, setStart] = useState(trip?.start_date ?? "");
  const [end, setEnd] = useState(trip?.end_date ?? "");
  const [places, setPlaces] = useState<Place[]>(trip?.places ?? draft?.places ?? []);
  const [rating, setRating] = useState<number | null>(trip?.rating ?? null);
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [cover, setCover] = useState(trip?.cover_url ?? "");
  const [mode, setMode] = useState<Mode>(trip ? tripMode(trip) : ideaMode(fromIdea?.holiday_types ?? []));
  const journey = useJourney(trip ?? draft ?? {}, !trip)(mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trips arrive newest first, so the oldest is ticket #01, as on the trips page.
  const index = trip ? trips.findIndex((t) => t.id === trip.id) : -1;
  const passNo = index >= 0 ? trips.length - index : trips.length + 1;
  const ticketNo = `#${String(passNo).padStart(2, "0")}`;
  const ordered = mode !== "flight";
  const heading = trip ? "Edit trip" : "Add a trip";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input: TripInput = {
      title,
      start_date: start || null,
      end_date: end || null,
      places,
      rating,
      notes: notes || null,
      cover_url: cover || null,
      ...modeFlags(mode),
      depart: journey.depart,
      arrive: journey.arrive,
      idea_id: trip?.idea_id ?? draft?.idea_id ?? null,
      created_by: trip?.created_by ?? me?.id ?? null,
    };
    setSaving(true);
    try {
      if (trip) await api.updateTrip(trip.id, input);
      else await api.createTrip(input);
      await reload();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!trip || !confirm(`Delete "${trip.title}"?`)) return;
    await api.deleteTrip(trip.id);
    await reload();
    onClose();
    onDeleted?.();
  };

  return (
    <Modal title={heading} onClose={onClose} bare>
      <form className={`trip-sheet mode-${mode}`} onSubmit={submit}>
        <header className="ts-head">
          <span className="ts-grabber mobile-only" aria-hidden />
          <div className="ts-head-row">
            <div className="ts-titles">
              <span className="mono-label mode-ink">{trip ? `TICKET ${ticketNo}` : `NEW TICKET · ${ticketNo}`}</span>
              <h2>{heading}</h2>
            </div>
            <button type="button" className="ts-close" onClick={onClose} aria-label="Close">
              <CrossIcon size={18} />
            </button>
          </div>
        </header>

        <div className="ts-body">
          <div className="ts-preview">
            <span className="mono-label muted">HOW IT WILL LOOK</span>
            <TripTicket
              preview
              passNo={passNo}
              trip={{ title, start_date: start || null, end_date: end || null, places, rating, cover_url: cover || null, depart: journey.depart, arrive: journey.arrive, ...modeFlags(mode) }}
            />
          </div>

          <Section title="THE TRIP">
            <label className="ts-field">
              <span className="field-label">Name</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Italian summer" required autoFocus={!trip} />
            </label>
            <div className="row two">
              <label className="ts-field">
                <span className="field-label">From</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="ts-field">
                <span className="field-label">To</span>
                <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
          </Section>

          <Section title="WHERE YOU WENT">
            <div className="ts-field" role="radiogroup" aria-labelledby="ts-mode-label">
              <span className="field-label" id="ts-mode-label">
                How did you travel?
              </span>
              <div className="ts-modes">
                {MODE_KEYS.map((k) => (
                  <button type="button" key={k} role="radio" aria-checked={mode === k} className={`ts-mode mode-${k} ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>
                    <ModeIcon mode={k} />
                    <span>{MODES[k].short}</span>
                  </button>
                ))}
              </div>
              <span className="muted small">{MODE_HINT[mode]}</span>
            </div>

            <div className="ts-field">
              <div className="ts-label-row">
                <span className="field-label">Places</span>
                <span className="muted small">{ordered ? "In the order you went" : "Where you stayed"}</span>
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
                        <button type="button" onClick={() => setPlaces(places.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>
                          <CrossIcon />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <PlaceSearch icon onAdd={(p) => setPlaces([...places, p])} placeholder={places.length ? "Add another place…" : "Search for a city…"} />
            </div>

            <JourneyCards mode={mode} journey={journey} />
          </Section>

          <Section title="MEMORIES">
            <div className="ts-field" role="group" aria-labelledby="ts-rating-label">
              <span className="field-label" id="ts-rating-label">
                Rating
              </span>
              <div className="ts-rating">
                <div className="ts-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      type="button"
                      key={n}
                      className={rating !== null && n <= rating ? "on" : ""}
                      aria-pressed={rating !== null && n <= rating}
                      aria-label={n === 1 ? "1 star" : `${n} stars`}
                      onClick={() => setRating(rating === n ? null : n)}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.9l6.6-.9z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <span className="muted small">{RATING_WORDS[rating ?? 0]}</span>
              </div>
            </div>
            <label className="ts-field">
              <span className="field-label">Notes</span>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Highlights, where you stayed…" />
            </label>
            <div className="ts-field">
              <label className="field-label" htmlFor="ts-cover">
                Cover photo
              </label>
              <div className="ts-cover">
                {cover ? (
                  <span className="ts-thumb photo" style={{ backgroundImage: cssUrl(cover) }} aria-hidden />
                ) : (
                  <span className="ts-thumb" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                    </svg>
                  </span>
                )}
                <input id="ts-cover" type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Paste a photo link" />
              </div>
              <span className="muted small">Shows on the left of your ticket.</span>
            </div>
          </Section>
          {error && <p className="error-text">{error}</p>}
        </div>

        <footer className="ts-foot">
          {trip && isOwner && (
            <button type="button" className="ts-delete" onClick={remove}>
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
            {saving ? "Saving…" : trip ? "Save changes" : "Add trip"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
