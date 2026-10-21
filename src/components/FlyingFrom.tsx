import { useState } from "react";
import type { From } from "../../shared/visitor";
import { Geo } from "./Geo";
import { setFlyingFrom } from "../visitor";

type Airports = typeof import("../../shared/mainAirports");

/**
 * "Rough flight times from Manchester. Change": where the page's flight times are from, and a way to
 * say otherwise. The choice is kept for next time (src/visitor.ts). The airport list only loads when
 * someone asks to change it. A signed-in family's times are from their home airport, set in Settings.
 */
export function FlyingFrom({ from, home }: { from: From; home: boolean }) {
  const [airports, setAirports] = useState<Airports | null>(null);
  const [open, setOpen] = useState(false);

  if (home) {
    return (
      <p className="muted small dg-flying-from">
        Rough flight times from your home airport, <Geo from={from} geo="name" />.
      </p>
    );
  }

  if (open && airports) {
    const { MAIN_AIRPORTS, airportChoice, airportFrom, airportGroups, mainAirport } = airports;
    return (
      <label className="dg-flying-from dg-flying-pick">
        <span className="field-label">Flying from</span>
        <select
          autoFocus
          value={mainAirport(from.code) ? from.code : ""}
          onChange={(e) => {
            const row = mainAirport(e.target.value);
            if (row) setFlyingFrom(airportFrom(row));
            setOpen(false);
          }}
          onBlur={() => setOpen(false)}
        >
          {!mainAirport(from.code) && <option value="">{from.name}</option>}
          {airportGroups(from.code).map(([code, name]) => (
            <optgroup key={code} label={name}>
              {MAIN_AIRPORTS.filter((r) => r[2] === code).map((r) => (
                <option key={r[0]} value={r[0]}>
                  {airportChoice(r)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    );
  }

  return (
    <p className="muted small dg-flying-from">
      Rough flight times from <Geo from={from} geo="name" />.{" "}
      <button
        type="button"
        className="link"
        onClick={() => {
          setOpen(true);
          if (!airports) void import("../../shared/mainAirports").then(setAirports);
        }}
      >
        Change
      </button>
    </p>
  );
}
