import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Idea, IdeaDetails, Place } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { Modal } from "../components/Modal";
import { PlaceSearch } from "../components/PlaceSearch";
import { PlaceChips } from "../components/PlaceChips";
import { IdeaDetailsFields } from "../components/IdeaDetails";
import { estimateTravel, formatHours } from "../../shared/travelTime";

export function IdeaForm({ idea, onClose, onDeleted }: { idea?: Idea; onClose: () => void; onDeleted?: () => void }) {
  const { me, reload, rounds, home } = useData();
  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [cover, setCover] = useState(idea?.cover_url ?? "");
  const [places, setPlaces] = useState<Place[]>(idea?.places ?? []);
  const [details, setDetails] = useState<IdeaDetails>({
    budget: idea?.budget ?? null,
    trip_length: idea?.trip_length ?? null,
    travel_time: idea?.travel_time ?? null,
    holiday_types: idea?.holiday_types ?? [],
  });
  // Travel time follows the distance from home until you pick one yourself.
  const estimate = estimateTravel(home, places);
  const [autoTravel, setAutoTravel] = useState(
    () => !idea || idea.travel_time === null || idea.travel_time === estimateTravel(home, idea.places)?.travel_time,
  );
  useEffect(() => {
    if (autoTravel && estimate) setDetails((d) => (d.travel_time === estimate.travel_time ? d : { ...d, travel_time: estimate.travel_time }));
  }, [autoTravel, estimate?.travel_time]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeDetails = (next: IdeaDetails) => {
    if (next.travel_time !== details.travel_time) setAutoTravel(false);
    setDetails(next);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openRound = rounds.find((r) => r.status === "open");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { title, description: description || null, cover_url: cover.trim() || null, places, created_by: idea?.created_by ?? me?.id ?? null, ...details };
    setSaving(true);
    try {
      if (idea) await api.updateIdea(idea.id, input);
      else await api.createIdea(input);
      await reload();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!idea) return;
    const warn = openRound ? " Any points on it in the current round go back to whoever spent them." : "";
    if (!confirm(`Delete "${idea.title}"?${warn}`)) return;
    await api.deleteIdea(idea.id);
    await reload();
    onClose();
    onDeleted?.();
  };

  return (
    <Modal title={idea ? "Edit idea" : "New holiday idea"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Japan by train" required autoFocus={!idea} />
        </label>
        <div className="field">
          <span>Places</span>
          <PlaceChips places={places} onRemove={(i) => setPlaces(places.filter((_, j) => j !== i))} />
          <PlaceSearch onAdd={(p) => setPlaces([...places, p])} />
        </div>
        <IdeaDetailsFields value={details} onChange={changeDetails} />
        {estimate && home ? (
          <p className="muted small travel-hint">
            ✈️ About {formatHours(estimate.hours)} from {home.name} ({Math.round(estimate.km).toLocaleString("en-GB")} km).{" "}
            {autoTravel ? (
              "Travel time is set from this."
            ) : estimate.travel_time !== details.travel_time ? (
              <button type="button" className="link" onClick={() => setAutoTravel(true)}>
                Use the estimate
              </button>
            ) : null}
          </p>
        ) : (
          !home && <p className="muted small travel-hint">Set your home in Settings and travel time will fill itself in.</p>
        )}
        <label>
          Cover photo link
          <input type="url" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" />
        </label>
        <label>
          Notes
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why it's great, rough budget, best time to go…" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          {idea && (
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
