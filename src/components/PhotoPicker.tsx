import { useEffect, useRef, useState } from "react";
import type { Place } from "../../shared/types";
import type { PhotoCredit, PhotoSuggestion } from "../../shared/photos";
import { COMMONS_URL, UNSPLASH_URL, photoQueries } from "../../shared/photos";
import { api } from "../api";

export interface CoverChoice {
  url: string;
  credit: PhotoCredit | null;
  /** Set for an Unsplash suggestion, so it can be reported once the form is saved. */
  download: string | null;
}

/**
 * Cover photo field: a few photos of the places to tap, and a box for your own
 * link. Suggestions load straight away when there's no cover yet, and on
 * request when there is, to save looking up photos nobody needs.
 */
export function PhotoPicker({ places, value, onChange }: { places: Place[]; value: CoverChoice; onChange: (c: CoverChoice) => void }) {
  const [wanted, setWanted] = useState(!value.url);
  const [photos, setPhotos] = useState<PhotoSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const queries = photoQueries(places);
  const key = queries.join("|");

  useEffect(() => {
    if (!wanted || !key) {
      setPhotos([]);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const found = await api.photos(key.split("|"));
        if (mine === seq.current) {
          setPhotos(found);
          setError(false);
        }
      } catch {
        if (mine === seq.current) setError(true);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [wanted, key]);

  const pick = (p: PhotoSuggestion) => onChange({ url: p.url, credit: p.credit, download: p.download });

  return (
    <div className="field photo-picker">
      <span>Cover photo</span>
      {!wanted ? (
        <button type="button" className="btn ghost small photo-suggest" onClick={() => setWanted(true)} disabled={!key}>
          🖼️ Suggest photos of {places.length > 1 ? "these places" : "this place"}
        </button>
      ) : !key ? (
        <p className="muted small photo-hint">Add a place and some photos of it will show up here.</p>
      ) : (
        <>
          <div className="photo-grid" aria-busy={busy}>
            {busy && !photos.length
              ? Array.from({ length: 6 }, (_, i) => <span key={i} className="photo-tile loading" />)
              : photos.map((p) => (
                  <button
                    type="button"
                    key={p.url}
                    className={`photo-tile ${value.url === p.url ? "on" : ""}`}
                    aria-pressed={value.url === p.url}
                    aria-label={`Use this photo${p.alt ? `: ${p.alt}` : ""}, by ${p.credit.name}`}
                    onClick={() => pick(p)}
                  >
                    <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  </button>
                ))}
          </div>
          {!busy && !photos.length && <p className="muted small photo-hint">{error ? "Couldn't load photo suggestions right now." : "No photos found for these places."}</p>}
        </>
      )}
      {value.credit && <CoverCredit credit={value.credit} />}
      <input
        type="url"
        value={value.url}
        onChange={(e) => onChange({ url: e.target.value, credit: null, download: null })}
        placeholder="Or paste a photo link: https://…"
        aria-label="Cover photo link"
      />
    </div>
  );
}

/** "Photo: Jane Doe / Unsplash", linked the way Unsplash and Commons ask. */
export function CoverCredit({ credit }: { credit: PhotoCredit }) {
  const site = credit.source === "Unsplash" ? UNSPLASH_URL : COMMONS_URL;
  const name = credit.url ? (
    <a href={credit.url} target="_blank" rel="noopener noreferrer">
      {credit.name}
    </a>
  ) : (
    credit.name
  );
  return (
    <p className="muted small photo-credit">
      Photo: {name}
      {credit.license && `, ${credit.license}`} /{" "}
      <a href={site} target="_blank" rel="noopener noreferrer">
        {credit.source}
      </a>
    </p>
  );
}
