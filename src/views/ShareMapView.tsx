import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useData } from "../data";
import { summarise } from "../countries";
import { WORLD_COUNTRIES, continentOf } from "../continents";
import { plural } from "../format";
import { loadCountries } from "../countryShapes";
import type { CountryShapes } from "../countryShapes";
import { load, save } from "../storage";
import {
  BEEN_SWATCHES,
  FORMATS,
  IDEA_SWATCHES,
  THEMES,
  areaLabel,
  describeCard,
  drawShareCard,
  loadShareFonts,
} from "../shareCard";
import type { Format, ShareData, ShareOptions, SharePlace, StatKey, ThemeId } from "../shareCard";

/** Everything you can change except the words, remembered by this browser for next time. */
type Settings = Omit<ShareOptions, "title" | "subtitle"> & {
  /** Your own title and line under it, or null to use the ones worked out from your trips. */
  title: string | null;
  subtitle: string | null;
};

const SETTINGS_KEY = "shareMap";
const DEFAULTS: Settings = {
  format: "post",
  theme: "light",
  mapStyle: "filled",
  area: "world",
  shade: "been",
  pinStyle: "dots",
  labels: "names",
  showIdeas: true,
  been: "auto",
  idea: "auto",
  stats: { countries: true, percent: true, continents: true, trips: false },
  statStyle: "simple",
  brandPos: "bottom",
  showUrl: true,
  title: null,
  subtitle: null,
};

const DEFAULT_TITLE = "Where we’ve been";

type Section = "words" | "look" | "map" | "stats" | "brand";
const SECTIONS: [Section, string][] = [
  ["words", "Words"],
  ["look", "Look"],
  ["map", "Map"],
  ["stats", "Stats"],
  ["brand", "Brand"],
];

/** Make a picture of the family's map to post on Instagram, TikTok or Pinterest. */
export function ShareMapView() {
  const { trips, ideas } = useData();
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...load<Partial<Settings>>(SETTINGS_KEY, {}) }));
  const [section, setSection] = useState<Section>("look");
  const [shapes, setShapes] = useState<CountryShapes | null>(null);
  const [saved, setSaved] = useState<"saving" | "done" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadCountries(), loadShareFonts()]).then(([s]) => {
      if (!cancelled) setShapes(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => save(SETTINGS_KEY, settings), [settings]);

  const data = useMemo<ShareData>(() => {
    const visitedSummary = summarise(trips.map((t) => t.places));
    const visited = new Set(visitedSummary.map((c) => c.code));
    const activeIdeas = ideas.filter((i) => i.status === "active" || i.status === "won");
    const ideaCountries = new Set(activeIdeas.flatMap((i) => i.places.map((p) => p.country_code)).filter((c) => !visited.has(c)));
    const places: SharePlace[] = [];
    const seen = new Set<string>();
    const add = (p: { name: string; country_code: string; lat: number | null; lon: number | null }, kind: SharePlace["kind"]) => {
      const key = `${p.name}|${p.country_code}`;
      if (p.lat === null || p.lon === null || seen.has(key)) return;
      seen.add(key);
      places.push({ name: p.name, code: p.country_code, lat: p.lat, lon: p.lon, kind });
    };
    for (const t of trips) for (const p of t.places) add(p, "been");
    for (const i of activeIdeas) for (const p of i.places) add(p, "idea");

    const byContinent = new Map<string, number>();
    for (const code of visited) {
      const c = continentOf(code);
      if (c) byContinent.set(c, (byContinent.get(c) ?? 0) + 1);
    }
    const continent = [...byContinent.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      visited,
      ideaCountries,
      places,
      continent,
      stats: {
        countries: visited.size,
        percent: Math.round((visited.size / WORLD_COUNTRIES) * 100),
        continents: byContinent.size,
        trips: trips.length,
      },
    };
  }, [trips, ideas]);

  const autoSubtitle = useMemo(() => {
    const years = trips.map((t) => Number(t.start_date?.slice(0, 4))).filter((y) => y > 1900);
    if (!trips.length) return "Our travel map";
    return [years.length ? `Since ${Math.min(...years)}` : null, plural(trips.length, "trip")].filter(Boolean).join(" · ");
  }, [trips]);

  const options: ShareOptions = { ...settings, title: settings.title ?? DEFAULT_TITLE, subtitle: settings.subtitle ?? autoSubtitle };
  const format = FORMATS[settings.format];
  const size = `1080 × ${format.h * 2}`;

  useEffect(() => {
    if (canvas.current) drawShareCard(canvas.current, shapes, data, options);
    // options is rebuilt each render from these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, data, settings, autoSubtitle]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  const fileName = `somewhere-party-map-${settings.format}.png`;
  const toFile = () =>
    new Promise<File>((resolve, reject) =>
      canvas.current?.toBlob((b) => (b ? resolve(new File([b], fileName, { type: "image/png" })) : reject(new Error("Couldn’t make the picture."))), "image/png"),
    );

  const download = async () => {
    setError(null);
    setSaved("saving");
    try {
      const file = await toFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSaved("done");
    } catch (e) {
      setError((e as Error).message);
      setSaved(null);
    }
  };

  // Phones can hand the picture straight to Instagram and friends. Elsewhere, Share saves it instead.
  const share = async () => {
    setError(null);
    try {
      const file = await toFile();
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: options.title });
      else await download();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
  };

  const ready = shapes !== null;
  const actions = (
    <div className="share-actions">
      <div className="share-buttons">
        <button className="btn" disabled={!ready} onClick={() => void download()}>
          {saved === "done" ? "Saved ✓" : "Download image"}
        </button>
        <button className="btn ghost" disabled={!ready} onClick={() => void share()}>
          Share…
        </button>
      </div>
      {error ? (
        <p className="share-note error-text">{error}</p>
      ) : (
        <p className="share-note">
          {saved === "done"
            ? `Saved as a ${size} PNG.`
            : `Saves a ${size} PNG. On a phone, Share opens your share sheet so you can post it straight away.`}
        </p>
      )}
    </div>
  );

  const themeColour = (key: "been" | "idea") => THEMES[settings.theme][key];

  return (
    <section className="share-page">
      <a className="back-link" href="#/places">
        ← Back to places
      </a>
      <div className="share-head">
        <h1 className="display">Share your map</h1>
        <p className="muted">Make a picture of everywhere you’ve been, ready to post on Instagram, TikTok or Pinterest.</p>
      </div>

      <div className="share-layout">
        <section className="share-preview" aria-label="Preview">
          <div className="share-formats" role="group" aria-label="Image size">
            {(Object.keys(FORMATS) as Format[]).map((id) => (
              <button key={id} type="button" aria-pressed={settings.format === id} onClick={() => set("format", id)}>
                <span className="share-format-top">
                  <strong>{FORMATS[id].name}</strong>
                  <span className="mono">{FORMATS[id].ratio}</span>
                </span>
                <span className="share-format-where">{FORMATS[id].where}</span>
              </button>
            ))}
          </div>
          <div className="share-stage">
            <canvas ref={canvas} role="img" aria-label={describeCard(data, options)} className={ready ? "" : "loading"} />
          </div>
          <p className="share-note center desktop-only">
            Exports at {size} px for {format.where}
          </p>
          <div className="mobile-only">{actions}</div>
        </section>

        <aside className="share-settings" aria-label="Settings">
          <div className="segmented share-tabs mobile-only" role="group" aria-label="Settings">
            {SECTIONS.map(([id, label]) => (
              <button key={id} type="button" className={section === id ? "active" : ""} aria-pressed={section === id} onClick={() => setSection(id)}>
                {label}
              </button>
            ))}
          </div>

          <div className="share-sections">
            <SettingsSection id="words" current={section} title="Words">
              <label className="field">
                <span>Title</span>
                <input type="text" value={options.title} maxLength={60} onChange={(e) => set("title", e.target.value)} />
              </label>
              <label className="field">
                <span>Line under the title</span>
                <input type="text" value={options.subtitle} maxLength={80} onChange={(e) => set("subtitle", e.target.value)} />
              </label>
              {(settings.title !== null || settings.subtitle !== null) && (
                <button
                  type="button"
                  className="btn ghost small share-reset"
                  onClick={() => setSettings((s) => ({ ...s, title: null, subtitle: null }))}
                >
                  Use the suggested words
                </button>
              )}
            </SettingsSection>

            <SettingsSection id="look" current={section} title="Look">
              <div className="share-themes" role="group" aria-label="Theme">
                {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                  const th = THEMES[id];
                  return (
                    <button key={id} type="button" aria-pressed={settings.theme === id} onClick={() => set("theme", id)}>
                      <span className="share-theme-chip" style={{ background: th.bg }}>
                        <i style={{ background: th.land }} />
                        <i style={{ background: th.been }} />
                        <i style={{ background: th.idea }} />
                      </span>
                      <span>{th.name}</span>
                    </button>
                  );
                })}
              </div>
              <Choice
                label="Map style"
                value={settings.mapStyle}
                onChange={(v) => set("mapStyle", v)}
                options={[
                  ["filled", "Filled"],
                  ["dotted", "Dotted"],
                  ["outline", "Outline"],
                ]}
              />
              <Choice
                label="Area"
                value={settings.area}
                onChange={(v) => set("area", v)}
                options={[
                  ["world", areaLabel("world", data.continent)],
                  ...(data.continent ? [["continent", areaLabel("continent", data.continent)] as ["continent", string]] : []),
                  ["fit", areaLabel("fit", data.continent)],
                ]}
              />
              <div className="share-colours">
                <Swatches
                  label="Been there"
                  value={settings.been}
                  auto={themeColour("been")}
                  list={BEEN_SWATCHES}
                  onChange={(v) => set("been", v)}
                />
                <Swatches
                  label="Ideas on standby"
                  value={settings.idea}
                  auto={themeColour("idea")}
                  list={IDEA_SWATCHES}
                  onChange={(v) => set("idea", v)}
                />
                <p className="share-note">The first colour in each row follows the theme.</p>
              </div>
            </SettingsSection>

            <SettingsSection id="map" current={section} title="On the map">
              <label className="share-check">
                <input type="checkbox" checked={settings.showIdeas} onChange={(e) => set("showIdeas", e.target.checked)} />
                Show ideas on standby
              </label>
              <Choice
                label="Shade countries"
                value={settings.shade}
                onChange={(v) => set("shade", v)}
                options={[
                  ["been", "Been"],
                  ["both", "Been + ideas"],
                  ["none", "None"],
                ]}
              />
              <Choice
                label="Pins"
                value={settings.pinStyle}
                onChange={(v) => set("pinStyle", v)}
                options={[
                  ["dots", "Dots"],
                  ["pins", "Pins"],
                  ["none", "None"],
                ]}
              />
              <Choice
                label="Labels"
                value={settings.labels}
                onChange={(v) => set("labels", v)}
                options={[
                  ["none", "None"],
                  ["names", "Names"],
                  ["flags", "With flags"],
                ]}
              />
            </SettingsSection>

            <SettingsSection id="stats" current={section} title="Stats">
              <div className="share-stat-checks" role="group" aria-label="Stats to show">
                {(
                  [
                    ["countries", "Countries"],
                    ["percent", "% of the world"],
                    ["continents", "Continents"],
                    ["trips", "Trips"],
                  ] as [StatKey, string][]
                ).map(([key, label]) => (
                  <label key={key} className="share-check">
                    <input type="checkbox" checked={settings.stats[key]} onChange={(e) => set("stats", { ...settings.stats, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              <Choice
                label="Style"
                value={settings.statStyle}
                onChange={(v) => set("statStyle", v)}
                options={[
                  ["simple", "Simple"],
                  ["board", "Departures board"],
                ]}
              />
            </SettingsSection>

            <SettingsSection id="brand" current={section} title="Branding">
              <Choice
                label="Wordmark"
                value={settings.brandPos}
                onChange={(v) => set("brandPos", v)}
                options={[
                  ["top", "Top"],
                  ["bottom", "Bottom"],
                ]}
              />
              <label className="share-check">
                <input type="checkbox" checked={settings.showUrl} onChange={(e) => set("showUrl", e.target.checked)} />
                Show the somewhere.party address
              </label>
              <p className="share-note">The somewhere🎉 wordmark is always on the picture.</p>
            </SettingsSection>
          </div>

          <div className="desktop-only share-aside-foot">{actions}</div>
        </aside>
      </div>
    </section>
  );
}

/** One group of settings: all shown on a computer, one at a time behind tabs on a phone. */
function SettingsSection({ id, current, title, children }: { id: Section; current: Section; title: string; children: ReactNode }) {
  return (
    <section className={`share-section${id === current ? " current" : ""}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  // A choice that's no longer offered (no continent yet) falls back to the first one.
  const current = options.some(([id]) => id === value) ? value : options[0][0];
  return (
    <div className="share-choice" role="group" aria-label={label}>
      <span className="share-label">{label}</span>
      <div className="segmented" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([id, text]) => (
          <button key={id} type="button" className={current === id ? "active" : ""} aria-pressed={current === id} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatches({
  label,
  value,
  auto,
  list,
  onChange,
}: {
  label: string;
  value: string;
  auto: string;
  list: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
}) {
  const all: [string, string, string][] = [["auto", auto, "Theme colour"], ...list.map(([c, name]) => [c, c, name] as [string, string, string])];
  return (
    <div className="share-choice" role="group" aria-label={label}>
      <span className="share-label">{label}</span>
      <div className="share-swatches">
        {all.map(([id, color, name]) => (
          <button
            key={id}
            type="button"
            aria-label={`${label} colour: ${name}`}
            aria-pressed={value === id}
            style={{ background: color }}
            onClick={() => onChange(id)}
          />
        ))}
      </div>
    </div>
  );
}
