import { useState } from "react";
import type { FormEvent } from "react";
import type { Idea, IdeaDetails, Place } from "../../shared/types";
import { api } from "../api";
import { useData } from "../data";
import { Modal } from "../components/Modal";
import { IdeaDetailsFields } from "../components/IdeaDetails";
import { CoverField, MODE_HINT, ModePicker, PlacesField, SheetFoot, SheetHead, SheetPreview, SheetSection } from "../components/Sheet";
import { StandbyCard } from "../components/StandbyCard";
import { JourneyCards, useJourney } from "../components/TerminalPicker";
import { ideaMode } from "../../shared/travelMode";
import type { Mode } from "../../shared/travelMode";
import type { HolidayType } from "../../shared/ideaDetails";
import { estimateTravel, formatHours } from "../../shared/travelTime";
import { travelTimeLabel } from "../../shared/ideaDetails";

const MODE_TYPE: Record<Exclude<Mode, "flight">, HolidayType> = { train: "rail", cruise: "cruise", road: "road-trip" };
const MODE_TYPES: readonly HolidayType[] = Object.values(MODE_TYPE);

export function IdeaForm({ idea, onClose, onDeleted }: { idea?: Idea; onClose: () => void; onDeleted?: () => void }) {
  const { me, reload, rounds, home, isOwner } = useData();
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
  const mode = ideaMode(details.holiday_types);
  const journey = useJourney(idea ?? {}, !idea)(mode);
  // Travel time is measured from where you set off, or from the home airport without one.
  const origin = journey.depart ?? home;
  const estimate = estimateTravel(origin, places);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openRound = rounds.find((r) => r.status === "open");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { title, description: description || null, cover_url: cover.trim() || null, places, depart: journey.depart, arrive: journey.arrive, created_by: idea?.created_by ?? me?.id ?? null, ...details };
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

  // How you'd travel is kept as a holiday type; picking a mode swaps it, and flying means none of them.
  const setMode = (m: Mode) =>
    setDetails({ ...details, holiday_types: [...details.holiday_types.filter((t) => !MODE_TYPES.includes(t)), ...(m === "flight" ? [] : [MODE_TYPE[m]])] });
  const ordered = mode !== "flight";
  const status = idea?.status === "won" ? "WINNER" : idea?.status === "done" ? "DONE" : "STANDBY";
  const heading = idea ? "Edit idea" : "New holiday idea";

  return (
    <Modal title={heading} onClose={onClose} bare>
      <form className={`trip-sheet mode-${mode}`} onSubmit={submit}>
        <SheetHead eyebrow={idea ? `IDEA · ${status}` : "NEW IDEA · STANDBY"} heading={heading} onClose={onClose} />

        <div className="ts-body">
          <SheetPreview>
            <StandbyCard
              preview
              idea={{ title, places, cover_url: cover.trim() || null, status: idea?.status ?? "active", created_by: idea?.created_by ?? me?.id ?? null, depart: journey.depart, arrive: journey.arrive, ...details }}
            />
          </SheetPreview>

          <SheetSection title="THE IDEA">
            <label className="ts-field">
              <span className="field-label">Name</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Japan by train" required autoFocus={!idea} />
            </label>
            <label className="ts-field">
              <span className="field-label">Notes</span>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why it's great, rough budget, best time to go…" />
            </label>
          </SheetSection>

          <SheetSection title="WHERE TO">
            <ModePicker label="How would you travel?" mode={mode} onChange={setMode} hint={MODE_HINT[mode]} />
            <PlacesField places={places} onChange={setPlaces} ordered={ordered} hint={ordered ? "In the order you'd go" : "Where you'd stay"} />
            <JourneyCards mode={mode} journey={journey} />
            <div className="ts-field">
              <span className="field-label">Travel time (each way)</span>
              <span className="muted small">
                {estimate && origin
                  ? `${travelTimeLabel(estimate.travel_time)}, about ${formatHours(estimate.hours)} from ${origin.name} (${Math.round(estimate.km).toLocaleString("en-GB")} km).`
                  : origin
                    ? `Worked out from ${journey.depart ? "where you set off" : "your home airport"} once you add a place.`
                    : "Set your home airport in Settings and it's worked out for you."}
              </span>
            </div>
          </SheetSection>

          <SheetSection title="THE DETAILS">
            <IdeaDetailsFields value={details} onChange={setDetails} hideTypes={MODE_TYPES} />
            <CoverField value={cover} onChange={setCover} hint="Shows at the top of the idea's card." />
          </SheetSection>
          {error && <p className="error-text">{error}</p>}
        </div>

        <SheetFoot onDelete={idea && isOwner ? remove : undefined} onClose={onClose} saving={saving} saveLabel={idea ? "Save changes" : "Add idea"} />
      </form>
    </Modal>
  );
}
