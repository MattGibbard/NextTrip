import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Mode } from "../../shared/travelMode";
import { MODES } from "../../shared/travelMode";
import { useData } from "../data";
import { chunk, pendingStamps, stampDate, visitStamps } from "../passport";
import type { PendingStamp, StampLook, VisitStamp } from "../passport";

type Page = { kind: "visits"; stamps: VisitStamp[] } | { kind: "pending"; stamps: PendingStamp[] } | { kind: "blank" };

/**
 * The Places passport: pages of entry stamps you swipe through, one page at a
 * time on phones and as an open two-page spread on wider screens.
 */
export function Passport({
  pending,
  onSelect,
  onAdd,
}: {
  pending: { code: string; name: string; idea: string }[];
  onSelect: (code: string) => void;
  onAdd: () => void;
}) {
  const { trips } = useData();
  const visits = useMemo(() => visitStamps(trips), [trips]);
  const ideas = useMemo(() => pendingStamps(pending), [pending]);
  const pages = useMemo(() => {
    const out: Page[] = [
      ...chunk(visits).map((stamps): Page => ({ kind: "visits", stamps })),
      ...chunk(ideas).map((stamps): Page => ({ kind: "pending", stamps })),
    ];
    if (out.length === 0) out.push({ kind: "visits", stamps: [] });
    return out;
  }, [visits, ideas]);

  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [spread, setSpread] = useState(false);
  useEffect(() => {
    const wide = matchMedia("(min-width: 760px)");
    const update = () => setSpread(wide.matches);
    update();
    wide.addEventListener("change", update);
    return () => wide.removeEventListener("change", update);
  }, []);

  // A spread needs an even number of pages, so a lone last page gets a blank partner.
  const shown: Page[] = spread && pages.length % 2 ? [...pages, { kind: "blank" }] : pages;
  const step = spread ? 2 : 1;
  const views = Math.ceil(shown.length / step);

  const onScroll = () => {
    const el = track.current;
    if (el) setAt(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (view: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(views - 1, view)) * el.clientWidth, behavior: "smooth" });
  };
  useEffect(() => {
    if (at > views - 1) go(views - 1);
  });

  const first = at * step + 1;
  const last = Math.min(shown.length, first + step - 1);
  const numbered = Math.min(last, pages.length);

  return (
    <div className="passport-book">
      <div className={`passport-pages${spread ? " spread" : ""}`} ref={track} onScroll={onScroll}>
        {shown.map((page, i) => (
          <PassportPage key={i} number={i + 1} side={spread ? (i % 2 ? "right" : "left") : "single"} blank={page.kind === "blank"}>
            {page.kind === "visits" &&
              page.stamps.map((s) => (
                <StampButton key={s.key} look={s.look} onClick={() => onSelect(s.code)} title={`${s.name}, ${stampDate(s.date).toLowerCase()}: see your trips there`}>
                  <VisitArt stamp={s} />
                </StampButton>
              ))}
            {page.kind === "pending" &&
              page.stamps.map((s) => (
                <StampButton key={s.key} look={s.look} pending onClick={() => onSelect(s.code)} title={`${s.name}: an idea, not been yet`}>
                  <PendingArt stamp={s} />
                </StampButton>
              ))}
            {page.kind === "pending" && i === pages.findIndex((p) => p.kind === "pending") && <span className="visa-note">Visas pending</span>}
            {page.kind === "visits" && page.stamps.length === 0 && <p className="muted center passport-empty">Add trips with places to collect stamps.</p>}
          </PassportPage>
        ))}
      </div>
      <div className="passport-nav">
        <button className="icon-btn" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous page">
          ‹
        </button>
        <span className="mono-label">
          {first === numbered ? `PAGE ${first}` : `PAGES ${first}–${numbered}`} OF {pages.length}
        </span>
        <button className="icon-btn" onClick={() => go(at + 1)} disabled={at >= views - 1} aria-label="Next page">
          ›
        </button>
        <button className="btn ghost small desktop-only add-trip" onClick={onAdd}>
          + Add trip
        </button>
      </div>
    </div>
  );
}

function PassportPage({ number, side, blank, children }: { number: number; side: "left" | "right" | "single"; blank: boolean; children: ReactNode }) {
  return (
    <div className={`passport-page ${side}`} aria-label={blank ? undefined : `Page ${number}`}>
      {!blank && (
        <>
          <span className="visa-head">VISAS · VISAS</span>
          {children}
          <span className="visa-num">{number}</span>
        </>
      )}
    </div>
  );
}

function StampButton({ look, pending, onClick, title, children }: { look: StampLook; pending?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  const style = {
    left: `${look.x}%`,
    top: `${look.y}%`,
    width: `${look.width}%`,
    "--tilt": `${look.tilt}deg`,
    "--ink": pending ? "var(--pencil)" : `var(--ink-${look.ink})`,
  } as CSSProperties;
  return (
    <button className={`stamp-spot${pending ? " pending" : ""}`} style={style} onClick={onClick} title={title} aria-label={title}>
      {children}
    </button>
  );
}

/**
 * Real stamps never print evenly: the ink thins out towards one side, the edges
 * bleed a little, and small specks don't take. This wraps the stamp's lines in
 * a filter and mask that do the same, varied per stamp by its seed.
 */
function Inked({ look, box, children }: { look: StampLook; box: [number, number]; children: ReactNode }) {
  const id = useId().replace(/:/g, "");
  const [w, h] = box;
  // Patchy fade: low-frequency noise turned into alpha. More fade lowers the floor.
  const blotchB = -0.8 - look.fade;
  return (
    <>
      <defs>
        <filter id={`ink${id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={0.025 + (look.seed % 7) * 0.004} numOctaves={2} seed={look.seed} result="blotch" />
          <feColorMatrix in="blotch" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  4 0 0 0 ${blotchB}`} />
          {/* Never fades out altogether: a stamp is always at least faintly there. */}
          <feComponentTransfer result="fade">
            <feFuncA type="table" tableValues="0.15 1" />
          </feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency={0.75} numOctaves={1} seed={look.seed + 1} result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  6 0 0 0 -1.6" result="specks" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale={2.4} xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feComposite in="rough" in2="fade" operator="in" result="faded" />
          <feComposite in="faded" in2="specks" operator="in" />
        </filter>
        <linearGradient id={`press${id}`} gradientTransform={`rotate(${look.pressure} 0.5 0.5)`}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor={look.fade > 0.4 ? "#555" : "#999"} />
        </linearGradient>
        <mask id={`mask${id}`}>
          <rect width={w} height={h} fill={`url(#press${id})`} />
        </mask>
      </defs>
      <g mask={`url(#mask${id})`}>
        <g filter={`url(#ink${id})`}>{children}</g>
      </g>
    </>
  );
}

// Material Design icons (Apache 2.0), drawn in the stamp's ink.
const ICONS: Record<Mode, string> = {
  flight: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  train:
    "M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
  cruise:
    "M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z",
  road: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
};

function Icon({ mode, x, y, size }: { mode: Mode; x: number; y: number; size: number }) {
  return <path d={ICONS[mode]} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})`} fill="currentColor" stroke="none" />;
}

/** Squeezes text that would run past `max` units wide, assuming monospace glyphs about 0.6em across. */
function fit(text: string, size: number, max: number) {
  return text.length * size * 0.62 > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {};
}

function Txt({ x, y, size, weight = 500, spacing = 0, max, children }: { x: number; y: number; size: number; weight?: number; spacing?: number; max: number; children: string }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} letterSpacing={spacing} textAnchor="middle" fill="currentColor" stroke="none" {...fit(children, size + spacing, max)}>
      {children}
    </text>
  );
}

function VisitArt({ stamp }: { stamp: VisitStamp }) {
  const { look, mode } = stamp;
  const name = stamp.name.toUpperCase();
  const date = stampDate(stamp.date);
  const id = useId().replace(/:/g, "");

  if (look.shape === "circle") {
    return (
      <svg viewBox="0 0 200 200" className="stamp-art">
        <Inked look={look} box={[200, 200]}>
          <g fill="none" stroke="currentColor">
            <circle cx="100" cy="100" r="94" strokeWidth="5" />
            <circle cx="100" cy="100" r="64" strokeWidth="2" />
            <line x1="38" y1="86" x2="162" y2="86" strokeWidth="2" />
            <line x1="38" y1="116" x2="162" y2="116" strokeWidth="2" />
          </g>
          <path id={`top${id}`} d="M 28 100 A 72 72 0 0 1 172 100" fill="none" />
          <path id={`bot${id}`} d="M 14 100 A 86 86 0 0 0 186 100" fill="none" />
          <text fontSize="17" fontWeight="600" letterSpacing="1" fill="currentColor">
            <textPath href={`#top${id}`} startOffset="50%" textAnchor="middle" {...fit(name, 18, 190)}>
              {name}
            </textPath>
          </text>
          <text fontSize="13" letterSpacing="2" fill="currentColor">
            <textPath href={`#bot${id}`} startOffset="50%" textAnchor="middle" {...fit(stamp.entry, 15, 150)}>
              {stamp.entry}
            </textPath>
          </text>
          <Icon mode={mode} x={100} y={64} size={24} />
          <Txt x={100} y={107} size={16} max={118}>
            {date}
          </Txt>
          <Txt x={100} y={140} size={11} spacing={1.5} max={100}>
            {look.label}
          </Txt>
          <text x="22" y="105" fontSize="12" textAnchor="middle" fill="currentColor">
            ★
          </text>
          <text x="178" y="105" fontSize="12" textAnchor="middle" fill="currentColor">
            ★
          </text>
        </Inked>
      </svg>
    );
  }

  if (look.shape === "oval") {
    return (
      <svg viewBox="0 0 240 160" className="stamp-art">
        <Inked look={look} box={[240, 160]}>
          <g fill="none" stroke="currentColor">
            <ellipse cx="120" cy="80" rx="114" ry="74" strokeWidth="4.5" />
            <ellipse cx="120" cy="80" rx="104" ry="64" strokeWidth="1.5" />
          </g>
          <Txt x={120} y={44} size={12} spacing={2} max={130}>
            {look.label}
          </Txt>
          <Txt x={120} y={78} size={23} weight={700} spacing={1} max={180}>
            {name}
          </Txt>
          <Txt x={120} y={104} size={17} max={160}>
            {date}
          </Txt>
          <Icon mode={mode} x={78} y={126} size={16} />
          <text x="90" y="131" fontSize="12" letterSpacing="1" fill="currentColor" {...fit(stamp.entry, 13, 80)}>
            {stamp.entry}
          </text>
        </Inked>
      </svg>
    );
  }

  // The squarer stamps share a layout and differ only in outline.
  const outline =
    look.shape === "octagon"
      ? "M 26 6 H 194 L 214 26 V 134 L 194 154 H 26 L 6 134 V 26 Z"
      : look.shape === "arrow"
        ? "M 6 6 H 184 L 214 80 L 184 154 H 6 Z"
        : "M 6 6 H 214 V 154 H 6 Z";
  const inner =
    look.shape === "octagon"
      ? "M 30 14 H 190 L 206 30 V 130 L 190 146 H 30 L 14 130 V 30 Z"
      : look.shape === "arrow"
        ? "M 14 14 H 179 L 205 80 L 179 146 H 14 Z"
        : "M 14 14 H 206 V 146 H 14 Z";
  const cx = look.shape === "arrow" ? 102 : 110;
  const width = look.shape === "arrow" ? 160 : 176;
  return (
    <svg viewBox="0 0 220 160" className="stamp-art">
      <Inked look={look} box={[220, 160]}>
        <g fill="none" stroke="currentColor" strokeLinejoin="round">
          <path d={outline} strokeWidth="4.5" />
          {look.shape !== "rect" || look.seed % 2 ? <path d={inner} strokeWidth="1.5" /> : null}
          <line x1={cx - width / 2} y1="50" x2={cx + width / 2} y2="50" strokeWidth="1.5" />
        </g>
        <Icon mode={mode} x={cx - width / 2 + 16} y={36} size={18} />
        <Txt x={cx + 10} y={41} size={12} spacing={2} max={width - 44}>
          {`${look.label} · ${MODES[mode].short.toUpperCase()}`}
        </Txt>
        <Txt x={cx} y={80} size={22} weight={700} spacing={1} max={width - 8}>
          {name}
        </Txt>
        <Txt x={cx} y={106} size={17} max={width - 20}>
          {date}
        </Txt>
        <Txt x={cx} y={132} size={11} spacing={1.5} max={width - 20}>
          {`${stamp.entry} · Nº ${look.serial}`}
        </Txt>
      </Inked>
    </svg>
  );
}

/** A pencilled-in reminder rather than a stamp: dashed, grey and soft. */
function PendingArt({ stamp }: { stamp: PendingStamp }) {
  const round = stamp.look.shape === "circle" || stamp.look.shape === "oval";
  return (
    <svg viewBox="0 0 220 160" className="stamp-art">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="7 6">
        {round ? <ellipse cx="110" cy="80" rx="104" ry="72" /> : <rect x="6" y="6" width="208" height="148" rx="12" />}
      </g>
      <Txt x={110} y={44} size={12} spacing={2.5} max={140}>
        VISA PENDING
      </Txt>
      <Txt x={110} y={80} size={21} weight={600} spacing={1} max={180}>
        {stamp.name.toUpperCase()}
      </Txt>
      <text x="110" y="114" fontSize="15" textAnchor="middle" fill="currentColor" className="pencil-note" {...fit(stamp.idea, 15, 170)}>
        {stamp.idea}
      </text>
    </svg>
  );
}
