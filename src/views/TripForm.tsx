import { useState } from "react";
import type { FormEvent } from "react";
import type { Place, Trip, TripInput } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { Modal } from "../components/Modal";
import { CoverPicker } from "../components/CoverPicker";
import { MODE_HINT, ModePicker, PlacesField, SheetFoot, SheetHead, SheetPreview, SheetSection } from "../components/Sheet";
import { JourneyCards, useJourney } from "../components/TerminalPicker";
import { TripPostcard } from "../components/TripPostcard";
import { ideaMode, modeFlags, tripMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import type { Terminal } from "../../shared/terminals";

export interface TripDraft {
  title?: string;
  places?: Place[];
  idea_id?: number | null;
  depart?: Terminal | null;
  arrive?: Terminal | null;
}

const RATING_WORDS = ["Not rated yet", "Not for us", "It was OK", "Good", "Really good", "Loved it"];

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
  const cardNo = `Nº ${String(passNo).padStart(2, "0")}`;
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
      // A trip made from a drawn idea marks the idea as done.
      await reload(["trips", "ideas"]);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!trip || !confirm(`Delete "${trip.title}"?`)) return;
    await api.deleteTrip(trip.id);
    await reload(["trips", "ideas"]);
    onClose();
    onDeleted?.();
  };

  return (
    <Modal title={heading} onClose={onClose} bare>
      <form className={`trip-sheet mode-${mode}`} onSubmit={submit}>
        <SheetHead eyebrow={trip ? `POSTCARD ${cardNo}` : `NEW POSTCARD · ${cardNo}`} heading={heading} onClose={onClose} />

        <div className="ts-body">
          <SheetPreview>
            <TripPostcard
              preview
              trip={{ title, start_date: start || null, places, cover_url: cover || null, ...modeFlags(mode) }}
            />
          </SheetPreview>

          <SheetSection title="THE TRIP">
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
          </SheetSection>

          <SheetSection title="WHERE YOU WENT">
            <ModePicker label="How did you travel?" mode={mode} onChange={setMode} hint={MODE_HINT[mode]} />
            <PlacesField places={places} onChange={setPlaces} ordered={ordered} hint={ordered ? "In the order you went" : "Where you stayed"} />
            <JourneyCards mode={mode} journey={journey} />
          </SheetSection>

          <SheetSection title="MEMORIES">
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
            <CoverPicker places={places} value={cover} onChange={setCover} hint="Shows on the left of your ticket." />
          </SheetSection>
          {error && <p className="error-text">{error}</p>}
        </div>

        <SheetFoot onDelete={trip && isOwner ? remove : undefined} onClose={onClose} saving={saving} saveLabel={trip ? "Save changes" : "Add trip"} />
      </form>
    </Modal>
  );
}
