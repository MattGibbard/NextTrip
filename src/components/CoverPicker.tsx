import { useEffect, useRef, useState } from "react";
import type { Place } from "../../shared/types";
import type { PhotoSuggestion } from "../../shared/photos";
import { PHOTO_COUNT, PHOTO_PAGES, PHOTO_PATH, PIXABAY_URL, photoQueries } from "../../shared/photos";
import { api } from "../api";

type Search = { state: "loading" | "ready" | "busy" | "error" | "off"; photos: PhotoSuggestion[]; page: number; more: boolean };

/**
 * Cover photo: a few photos of the trip's places to tap, from Pixabay, with a
 * search box for other photos ("eiffel tower" rather than just "Paris") and a
 * link box for a photo of your own. A tapped photo is copied to somewhere🎉
 * first, since Pixabay's own links only last a day.
 */
export function CoverPicker({ places, value, onChange, hint }: { places: Place[]; value: string; onChange: (v: string) => void; hint: string }) {
  const [search, setSearch] = useState<Search>({ state: "loading", photos: [], page: 1, more: false });
  // Which suggestion each saved link came from, so the tapped tile stays ticked.
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const own = value !== "" && !value.startsWith(PHOTO_PATH);
  const [showLink, setShowLink] = useState(own);
  // Words typed into the photo search, or null while it shows the places. Never saved.
  const [words, setWords] = useState<string | null>(null);
  const typed = words?.replace(/\|/g, " ").trim() ?? "";
  const key = words !== null ? typed : photoQueries(places).join("\n");
  const seq = useRef(0);
  // Bumped by "Try again" when Pixabay was busy.
  const [tries, setTries] = useState(0);

  // Asked even with no places yet, to find out whether photo search is set up at all.
  useEffect(() => {
    const mine = ++seq.current;
    setSearch((s) => (s.state === "off" ? s : { state: "loading", photos: words !== null ? [] : s.photos, page: 1, more: false }));
    // Typed words wait a little longer, so a search isn't sent for every few letters.
    const t = setTimeout(async () => {
      try {
        const found = await api.photos(key ? key.split("\n") : []);
        if (mine === seq.current)
          setSearch({ state: !found.enabled ? "off" : found.busy ? "busy" : "ready", photos: found.photos, page: 1, more: found.photos.length >= PHOTO_COUNT });
      } catch {
        if (mine === seq.current) setSearch({ state: "error", photos: [], page: 1, more: false });
      }
    }, !key ? 0 : words !== null ? 700 : 400);
    return () => clearTimeout(t);
  }, [key, tries]);

  const loadMore = async () => {
    const mine = seq.current;
    const page = search.page + 1;
    setSearch((s) => ({ ...s, state: "loading" }));
    try {
      const found = await api.photos(key.split("\n"), page);
      if (mine !== seq.current) return;
      if (found.busy) {
        setError("Pixabay is busy right now. Try again in a moment.");
        return setSearch((s) => ({ ...s, state: "ready" }));
      }
      setError(null);
      setSearch((s) => {
        const seen = new Set(s.photos.map((p) => p.id));
        const fresh = found.photos.filter((p) => !seen.has(p.id));
        return { state: "ready", photos: [...s.photos, ...fresh], page, more: fresh.length > 0 && found.photos.length >= PHOTO_COUNT && page < PHOTO_PAGES };
      });
    } catch {
      if (mine === seq.current) setSearch((s) => ({ ...s, state: "ready", more: false }));
    }
  };

  const openSearch = () => setWords(places[0]?.name ?? "");

  const pick = async (p: PhotoSuggestion) => {
    setError(null);
    if (picked[p.id] && picked[p.id] === value) return onChange("");
    if (picked[p.id]) return onChange(picked[p.id]);
    setSaving(p.id);
    try {
      const { url } = await api.savePhoto(p.id);
      setPicked((m) => ({ ...m, [p.id]: url }));
      onChange(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  // The cover the trip already has, first, when it isn't one of today's suggestions.
  const current = value && !Object.values(picked).includes(value) ? value : null;
  const off = search.state === "off";
  const tiles = key && search.state === "loading" && !search.photos.length ? PHOTO_COUNT - (current ? 1 : 0) : 0;

  return (
    <div className="ts-field cover-picker">
      <div className="ts-label-row">
        <span className="field-label" id="cover-label">
          Cover photo
        </span>
        <span className="muted small">{hint}</span>
      </div>

      {!off && (
        <>
          {words !== null && (
            <div className="cover-search">
              <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                aria-label="Search for other photos"
                value={words}
                maxLength={100}
                onChange={(e) => setWords(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder="Try “eiffel tower” or “beach sunset”"
                enterKeyHint="search"
                autoFocus
              />
              <button type="button" className="cover-search-close" onClick={() => setWords(null)}>
                {places.length ? "Back to places" : "Close"}
              </button>
            </div>
          )}
          {key || current ? (
            <div className="cover-grid" role="group" aria-labelledby="cover-label" aria-busy={search.state === "loading"}>
              {current && (
                <button type="button" className="cover-tile on" aria-pressed onClick={() => onChange("")} aria-label="Current cover photo. Tap to remove it.">
                  <img src={current} alt="" referrerPolicy="no-referrer" />
                  <Tick />
                </button>
              )}
              {search.photos.map((p) => {
                const on = picked[p.id] !== undefined && picked[p.id] === value;
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={`cover-tile ${on ? "on" : ""} ${saving === p.id ? "saving" : ""}`}
                    aria-pressed={on}
                    aria-label={`Use this photo${p.alt ? `: ${p.alt}` : ""}`}
                    disabled={saving !== null}
                    onClick={() => pick(p)}
                  >
                    <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    {on && <Tick />}
                  </button>
                );
              })}
              {Array.from({ length: tiles }, (_, i) => (
                <span key={i} className="cover-tile loading" aria-hidden />
              ))}
            </div>
          ) : (
            <p className="cover-empty muted small">{words !== null ? "Type what you'd like a photo of." : "Add a place and photos of it show up here to pick from."}</p>
          )}
          {key && search.state === "ready" && !search.photos.length && (
            <p className="muted small">{words !== null ? "No photos for that. Try other words, or paste a link to one of your own." : "No photos found for these places. Search for other photos or paste a link to one of your own."}</p>
          )}
          {search.state === "busy" && (
            <p className="muted small">
              Pixabay is busy right now.{" "}
              <button type="button" className="cover-own" onClick={() => setTries((n) => n + 1)}>
                Try again
              </button>
            </p>
          )}
          {search.state === "error" && <p className="muted small">Couldn't load photos right now. You can still paste a link to one.</p>}
          {error && <p className="error-text small">{error}</p>}
          {key && search.more && (
            <button type="button" className="btn small ghost cover-more" onClick={loadMore} disabled={search.state === "loading"}>
              {search.state === "loading" ? "Loading…" : "More photos"}
            </button>
          )}
          <div className="cover-foot">
            {search.photos.length > 0 && (
              <span className="muted small">
                Photos from{" "}
                <a href={PIXABAY_URL} target="_blank" rel="noopener noreferrer">
                  Pixabay
                </a>
              </span>
            )}
            <span className="cover-links">
              {words === null && (
                <button type="button" className="cover-own" onClick={openSearch}>
                  Search other photos
                </button>
              )}
              {!showLink && (
                <button type="button" className="cover-own" onClick={() => setShowLink(true)}>
                  Use your own photo link
                </button>
              )}
            </span>
          </div>
        </>
      )}

      {(showLink || off) && (
        <input
          type="url"
          aria-label="Cover photo link"
          value={own || off ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a photo link: https://…"
          autoFocus={showLink && !own && !off}
        />
      )}
    </div>
  );
}

function Tick() {
  return (
    <span className="cover-tick" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}
