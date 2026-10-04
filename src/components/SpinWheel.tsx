import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { TicketRange } from "../../shared/draw";

const COLORS = ["#0f766e", "#ea580c", "#2563eb", "#db2777", "#ca8a04", "#7c3aed", "#059669", "#dc2626"];
const SIZE = 320;
const R = SIZE / 2;

function point(angleDeg: number, radius: number) {
  // 0° is straight up, increasing clockwise.
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [R + radius * Math.cos(a), R + radius * Math.sin(a)];
}

function slicePath(start: number, end: number) {
  if (end - start >= 359.999) return `M ${R} 0 A ${R} ${R} 0 1 1 ${R - 0.01} 0 Z`;
  const [x1, y1] = point(start, R);
  const [x2, y2] = point(end, R);
  return `M ${R} ${R} L ${x1} ${y1} A ${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
}

function shorten(s: string, max = 16) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function celebrate() {
  const end = Date.now() + 1500;
  const opts = { disableForReducedMotion: true, zIndex: 3000 };
  confetti({ ...opts, particleCount: 140, spread: 90, origin: { y: 0.55 } });
  const frame = () => {
    confetti({ ...opts, particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...opts, particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/**
 * A wheel with one slice per idea, sized by its tickets. It spins and stops on
 * the ticket the server already drew, so the animation shows the real result.
 */
export function SpinWheel({
  ranges,
  titleOf,
  winningTicket,
  onLanded,
}: {
  ranges: TicketRange[];
  titleOf: (ideaId: number) => string;
  winningTicket: number;
  onLanded: () => void;
}) {
  const total = ranges.reduce((n, r) => n + r.tickets, 0);
  const [rotation, setRotation] = useState(0);
  const landed = useRef(false);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced ? 1 : 5.5;

  useEffect(() => {
    // Middle of the winning ticket's sliver, nudged a little so it doesn't always land dead centre.
    const ticketAngle = 360 / total;
    const target = (winningTicket - 0.5) * ticketAngle + (Math.random() - 0.5) * ticketAngle * 0.6;
    const spins = reduced ? 1 : 6;
    const id = requestAnimationFrame(() => setRotation(spins * 360 + (360 - target)));
    // Fallback in case transitionend never fires (e.g. the tab is hidden).
    const t = setTimeout(land, duration * 1000 + 400);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function land() {
    if (landed.current) return;
    landed.current = true;
    celebrate();
    onLanded();
  }

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true" />
      <svg
        className="wheel"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Spinning prize wheel"
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}s` }}
        onTransitionEnd={land}
      >
        {ranges.map((r, i) => {
          const start = ((r.from - 1) / total) * 360;
          const end = (r.to / total) * 360;
          const mid = (start + end) / 2;
          const [lx, ly] = point(mid, R * 0.6);
          const color = COLORS[i % COLORS.length];
          return (
            <g key={r.idea_id}>
              <path d={slicePath(start, end)} fill={color} stroke="#fff" strokeWidth={2} />
              {end - start >= 14 && (
                <text
                  x={lx}
                  y={ly}
                  fill="#fff"
                  fontSize={end - start >= 40 ? 14 : 11}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${lx} ${ly})`}
                >
                  {shorten(titleOf(r.idea_id))}
                </text>
              )}
            </g>
          );
        })}
        <circle cx={R} cy={R} r={22} fill="var(--surface)" stroke="var(--border)" strokeWidth={3} />
        <text x={R} y={R} textAnchor="middle" dominantBaseline="central" fontSize={18}>
          🎟️
        </text>
      </svg>
    </div>
  );
}
