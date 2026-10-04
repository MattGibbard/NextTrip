import { useState } from "react";
import type { FormEvent } from "react";
import type { Place, Trip, TripInput } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { Modal } from "../components/Modal";
import { PlaceSearch } from "../components/PlaceSearch";
import { PlaceChips } from "../components/PlaceChips";
import { Stars } from "../components/Stars";

export interface TripDraft {
  title?: string;
  places?: Place[];
  idea_id?: number | null;
}

export function TripForm({ trip, draft, onClose, onDeleted }: { trip?: Trip; draft?: TripDraft; onClose: () => void; onDeleted?: () => void }) {
  const { me, reload, ideas } = useData();
  const fromIdea = ideas.find((i) => i.id === draft?.idea_id);
  const [title, setTitle] = useState(trip?.title ?? draft?.title ?? "");
  const [start, setStart] = useState(trip?.start_date ?? "");
  const [end, setEnd] = useState(trip?.end_date ?? "");
  const [places, setPlaces] = useState<Place[]>(trip?.places ?? draft?.places ?? []);
  const [rating, setRating] = useState<number | null>(trip?.rating ?? null);
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [cover, setCover] = useState(trip?.cover_url ?? "");
  const [roadTrip, setRoadTrip] = useState(trip?.road_trip ?? fromIdea?.holiday_types.includes("road-trip") ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      road_trip: roadTrip,
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
    <Modal title={trip ? "Edit trip" : "Add a trip"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Italian summer" required autoFocus={!trip} />
        </label>
        <div className="row two">
          <label>
            From
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>Places</span>
          <PlaceChips places={places} onRemove={(i) => setPlaces(places.filter((_, j) => j !== i))} />
          <PlaceSearch onAdd={(p) => setPlaces([...places, p])} />
        </div>
        <label className="check-row">
          <input type="checkbox" checked={roadTrip} onChange={(e) => setRoadTrip(e.target.checked)} />
          <span>
            <strong>🚗 Road trip</strong>
            <span className="muted small">The map joins the places in order instead of from the first one.</span>
          </span>
        </label>
        <div className="field">
          <span>Rating</span>
          <Stars value={rating} onChange={setRating} />
        </div>
        <label>
          Notes
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Highlights, where you stayed…" />
        </label>
        <label>
          Cover photo link
          <input type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          {trip && (
            <button type="button" className="btn danger ghost" onClick={remove}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
