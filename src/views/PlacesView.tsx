import { useMemo, useRef, useState } from "react";
import type { Trip } from "../../shared/types";
import { useData } from "../data";
import { countryName, flag, summarise } from "../countries";
import type { CountrySummary } from "../countries";
import { CONTINENT_NAMES, WORLD_COUNTRIES, continentOf } from "../continents";
import { dateRange, plural } from "../format";
import { WorldMap } from "../components/WorldMap";
import type { Pin } from "../components/WorldMap";

type Mode = "countries" | "cities" | "years";

export function PlacesView() {
  const { trips, ideas } = useData();
  const [showIdeas, setShowIdeas] = useState(true);
  const [mode, setMode] = useState<Mode>("countries");
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const visited = useMemo(() => summarise(trips.map((t) => t.places)), [trips]);
  const activeIdeas = useMemo(() => ideas.filter((i) => i.status === "active" || i.status === "won"), [ideas]);

  const { visitedCodes, ideaCodes, pins } = useMemo(() => {
    const visitedCodes = new Set(visited.map((c) => c.code));
    const ideaCodes = new Set<string>();
    const pins: Pin[] = [];
    const seen = new Set<string>();
    for (const t of trips)
      for (const p of t.places)
        if (p.lat !== null && p.lon !== null && !seen.has(`v${p.name}${p.country_code}`)) {
          seen.add(`v${p.name}${p.country_code}`);
          pins.push({ lat: p.lat, lon: p.lon, label: `${p.name}, ${p.country}`, kind: "visited" });
        }
    if (showIdeas)
      for (const i of activeIdeas)
        for (const p of i.places) {
          if (!visitedCodes.has(p.country_code)) ideaCodes.add(p.country_code);
          if (p.lat !== null && p.lon !== null && !seen.has(`i${p.name}${p.country_code}`)) {
            seen.add(`i${p.name}${p.country_code}`);
            pins.push({ lat: p.lat, lon: p.lon, label: `${p.name} (idea: ${i.title})`, kind: "idea" });
          }
        }
    return { visitedCodes, ideaCodes, pins };
  }, [trips, activeIdeas, visited, showIdeas]);

  const cities = useMemo(
    () =>
      visited
        .flatMap((c) => c.cities.map((city) => ({ ...city, code: c.code, country: c.name })))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [visited],
  );

  const continents = useMemo(() => new Set(visited.map((c) => continentOf(c.code)).filter(Boolean)), [visited]);
  const percent = Math.round((visited.length / WORLD_COUNTRIES) * 100);

  const select = (code: string, scroll = false) => {
    setSelected(code);
    if (scroll) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section>
      <div className="page-head">
        <h1>Where we've been</h1>
      </div>

      <div className="stats">
        <div title={`${percent}% of the world`}>
          <strong>{visited.length}</strong>
          <span>of {WORLD_COUNTRIES} countries</span>
          <i className="meter" style={{ ["--pct" as string]: `${Math.min(100, percent)}%` }} />
        </div>
        <div>
          <strong>{cities.length}</strong>
          <span>{cities.length === 1 ? "city" : "cities"}</span>
        </div>
        <div title={[...continents].join(", ")}>
          <strong>{continents.size}</strong>
          <span>of {CONTINENT_NAMES.length} continents</span>
        </div>
      </div>

      <div className="map-wrap" ref={mapRef}>
        <WorldMap visited={visitedCodes} ideas={ideaCodes} pins={pins} selected={selected} onSelect={select} />
        <div className="legend">
          <span>
            <i className="swatch visited" /> Been
          </span>
          <label>
            <input type="checkbox" checked={showIdeas} onChange={(e) => setShowIdeas(e.target.checked)} />
            <i className="swatch idea" /> Ideas
          </label>
        </div>
      </div>

      {selected ? (
        <CountryPanel code={selected} onClose={() => setSelected(null)} />
      ) : (
        visited.length > 0 && <p className="muted small center hint">Tap a country on the map to see your trips there.</p>
      )}

      <div className="segmented">
        <button className={mode === "countries" ? "active" : ""} onClick={() => setMode("countries")}>
          {plural(visited.length, "country", "countries")}
        </button>
        <button className={mode === "cities" ? "active" : ""} onClick={() => setMode("cities")}>
          {plural(cities.length, "city", "cities")}
        </button>
        <button className={mode === "years" ? "active" : ""} onClick={() => setMode("years")}>
          By year
        </button>
      </div>

      {visited.length === 0 && <p className="muted center">Add trips with places to see them here.</p>}

      {mode === "countries" && (
        <ul className="list">
          {visited.map((c) => (
            <CountryRow key={c.code} c={c} onClick={() => select(c.code, true)} />
          ))}
        </ul>
      )}
      {mode === "cities" && (
        <ul className="list">
          {cities.map((c) => (
            <li key={`${c.name}${c.code}`} className="list-row clickable" onClick={() => select(c.code, true)}>
              <span className="flag">{flag(c.code)}</span>
              <div className="grow">
                <strong>{c.name}</strong>
                <div className="muted small">{c.country}</div>
              </div>
              <span className="pill">{plural(c.count, "visit")}</span>
            </li>
          ))}
        </ul>
      )}
      {mode === "years" && <Timeline trips={trips} onSelect={(code) => select(code, true)} />}
    </section>
  );
}

function CountryRow({ c, onClick }: { c: CountrySummary; onClick: () => void }) {
  return (
    <li className="list-row clickable" onClick={onClick}>
      <span className="flag">{flag(c.code)}</span>
      <div className="grow">
        <strong>{c.name}</strong>
        <div className="muted small">{c.cities.map((x) => (x.count > 1 ? `${x.name} ×${x.count}` : x.name)).join(" · ")}</div>
      </div>
      <span className="pill">{plural(c.visits, "trip")}</span>
    </li>
  );
}

/** Trips and ideas for one country, shown when it's tapped on the map or in a list. */
function CountryPanel({ code, onClose }: { code: string; onClose: () => void }) {
  const { trips, ideas } = useData();
  const here = trips.filter((t) => t.places.some((p) => p.country_code === code));
  const ideasHere = ideas.filter((i) => (i.status === "active" || i.status === "won") && i.places.some((p) => p.country_code === code));
  const name = here[0]?.places.find((p) => p.country_code === code)?.country ?? countryName(code);
  const firstYear = here
    .map((t) => t.start_date?.slice(0, 4))
    .filter(Boolean)
    .sort()[0];

  return (
    <div className="panel country-panel">
      <div className="round-head">
        <div>
          <h2>
            {flag(code)} {name}
          </h2>
          <p className="muted small">
            {here.length ? `${plural(here.length, "trip")}${firstYear ? ` · first visited ${firstYear}` : ""}` : "Not been yet"} · {continentOf(code)}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {here.length > 0 && (
        <ul className="list compact">
          {here.map((t) => (
            <li key={t.id} className="list-row clickable" onClick={() => (location.hash = `/trips/${t.id}`)}>
              <div className="grow">
                <strong>{t.title}</strong>
                <div className="muted small">
                  {[
                    t.places
                      .filter((p) => p.country_code === code)
                      .map((p) => p.name)
                      .join(" · "),
                    dateRange(t.start_date, t.end_date),
                  ]
                    .filter(Boolean)
                    .join(" — ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {ideasHere.length > 0 && (
        <p className="small">
          💡 Ideas here: <strong>{ideasHere.map((i) => i.title).join(", ")}</strong>
        </p>
      )}
    </div>
  );
}

/** Trips grouped by year, flagging countries visited for the first time. */
function Timeline({ trips, onSelect }: { trips: Trip[]; onSelect: (code: string) => void }) {
  const years = useMemo(() => {
    const dated = trips.filter((t) => t.start_date).sort((a, b) => a.start_date!.localeCompare(b.start_date!));
    const seen = new Set<string>();
    const out = new Map<string, { trips: Trip[]; newCountries: { code: string; name: string }[] }>();
    for (const t of dated) {
      const y = t.start_date!.slice(0, 4);
      const entry = out.get(y) ?? { trips: [], newCountries: [] };
      entry.trips.push(t);
      for (const p of t.places)
        if (!seen.has(p.country_code)) {
          seen.add(p.country_code);
          entry.newCountries.push({ code: p.country_code, name: p.country });
        }
      out.set(y, entry);
    }
    return [...out.entries()].reverse();
  }, [trips]);
  const undated = trips.filter((t) => !t.start_date).length;

  return (
    <div className="timeline">
      {years.map(([year, { trips: list, newCountries }]) => (
        <div key={year} className="timeline-year">
          <div className="timeline-dot" />
          <h3>
            {year} <span className="muted small">· {plural(list.length, "trip")}</span>
          </h3>
          {newCountries.length > 0 && (
            <div className="details-line">
              {newCountries.map((c) => (
                <button key={c.code} className="detail new" onClick={() => onSelect(c.code)}>
                  New: {flag(c.code)} {c.name}
                </button>
              ))}
            </div>
          )}
          <ul className="timeline-trips">
            {list.map((t) => (
              <li key={t.id}>
                {[...new Set(t.places.map((p) => p.country_code))].map(flag).join(" ")}{" "}
                <a className="plain-link" href={`#/trips/${t.id}`}>
                  <strong>{t.title}</strong>
                </a>{" "}
                <span className="muted small">{dateRange(t.start_date, t.end_date)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {years.length === 0 && <p className="muted center">Add dates to your trips to see them on a timeline.</p>}
      {years.length > 0 && undated > 0 && <p className="muted small">{plural(undated, "trip")} without dates aren't shown.</p>}
    </div>
  );
}
