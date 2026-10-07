import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

/** One idea on the departures board. */
export interface BoardRow {
  id: number;
  code: string;
  title: string;
  tickets: number;
  win: boolean;
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const REMARK_LEN = 8;
/** Ticks a remark keeps scrambling for after it changes. */
const FLIP = 10;

/** Board lettering: capitals, digits and a little punctuation, no accents, no leading "The". */
export function boardText(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/^THE\s+/, "")
    .replace(/[^A-Z0-9 .&'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fit(s: string, n: number) {
  return s.length > n ? s.slice(0, n).trimEnd().padEnd(n) : s.padEnd(n);
}

/**
 * When each row changes from ON TIME. Losers drop out lowest odds first, with a
 * longer pause before the last one, and the winner switches to BOARDING last.
 */
export function boardTimeline(rows: BoardRow[]) {
  const settle = 34 + rows.length * 2;
  const losers = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !r.win)
    .sort((a, b) => a.r.tickets - b.r.tickets || a.i - b.i);
  const gap = Math.max(10, Math.min(24, Math.round(150 / Math.max(1, losers.length))));
  const at = new Map<number, number>();
  let t = settle + 8;
  losers.forEach(({ r }, k) => {
    if (k > 0) t += k === losers.length - 1 ? gap * 2 : gap;
    at.set(r.id, t);
  });
  const winAt = losers.length ? t + 28 : t;
  for (const r of rows) if (r.win) at.set(r.id, winAt);
  return { at, end: winAt + 14 };
}

export function useMedia(query: string) {
  const get = () => typeof matchMedia === "function" && matchMedia(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(query);
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [query]);
  return on;
}

/**
 * A split-flap departures board. It only draws the given moment (`tick`); the
 * caller runs the clock. Before a row's `at` it reads ON TIME, then DELAYED, or
 * BOARDING for the winner. With `still` set nothing scrambles.
 */
export function FlapBoard({
  rows,
  at,
  tick,
  meta,
  still,
}: {
  rows: BoardRow[];
  at: Map<number, number>;
  tick: number;
  meta: string;
  still: boolean;
}) {
  const narrow = useMedia("(max-width: 640px)");
  const destLen = narrow ? 10 : 16;
  const spin = (i: number, seed: number) => (still ? null : ALPHA[(tick * 7 + i * 13 + seed * 5) % ALPHA.length]);

  return (
    <section className="flap-board" aria-label="Departures board">
      <div className="fb-head">
        <div className="fb-title">
          <span className="fb-icon" aria-hidden>
            ✈️
          </span>
          <span>DEPARTURES</span>
        </div>
        <span className="mono-label fb-meta">{meta}</span>
      </div>
      <div className="fb-rows" role="list" style={{ "--dest": destLen } as CSSProperties}>
        <div className="fb-cols mono-label" aria-hidden>
          <span className="fb-c-code">Code</span>
          <span className="fb-c-dest">Destination</span>
          <span>Remarks</span>
        </div>
        {rows.map((r, ri) => {
          const when = at.get(r.id) ?? Infinity;
          const changed = tick >= when;
          const flipping = changed && tick < when + FLIP;
          const remark = changed ? (r.win ? "BOARDING" : "DELAYED") : "ON TIME";
          const state = changed ? (r.win ? "lit" : "dim") : "";
          const code = fit(r.code, 3);
          const dest = fit(boardText(r.title), destLen);
          const settleRemark = 26 + ri * 2;
          const cell = (target: string, i: number, settleAt: number, seed: number) => {
            const c = tick < settleAt ? spin(i, seed) : null;
            return c ?? target;
          };
          return (
            <div key={r.id} className={`fb-row ${state}`} role="listitem">
              <span className="visually-hidden">
                {r.title}: {remark.toLowerCase()}
              </span>
              <span className="fb-group" aria-hidden>
                {code.split("").map((ch, i) => (
                  <Flap key={i} c={cell(ch, i, 2 + i + ri * 2, ri)} />
                ))}
              </span>
              <span className="fb-group fb-dest" aria-hidden>
                {dest.split("").map((ch, i) => (
                  <Flap key={i} c={cell(ch, i + 3, 5 + i + ri * 2, ri)} />
                ))}
              </span>
              <span className="fb-group fb-remark" aria-hidden>
                {fit(remark, REMARK_LEN)
                  .split("")
                  .map((ch, i) => {
                    let c: string | null = null;
                    if (tick < settleRemark + i) c = spin(i, ri + 9);
                    else if (flipping && tick < when + 4 + i) c = spin(i, ri + 20);
                    return <Flap key={i} c={c ?? ch} />;
                  })}
              </span>
              <span className="fb-dot" aria-hidden />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Flap({ c }: { c: string }) {
  return <span className="fb-flap">{c === " " ? " " : c}</span>;
}
