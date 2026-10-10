import type { Geometry, Position } from "geojson";
import type { CountryShapes } from "./countryShapes";
import { alpha2FromNumeric, flag } from "./countries";

// Draws the "Share your map" picture onto a canvas. The same drawing is the preview on the page and
// the saved PNG, so what you see is exactly what you post. Everything happens in the browser: the
// family's places are never sent anywhere to make it.

export type Format = "post" | "square" | "story" | "pin";
export type ThemeId = "light" | "dark" | "board" | "paper" | "teal";
export type MapStyle = "filled" | "dotted" | "outline";
export type Area = "world" | "continent" | "fit";
export type Shade = "been" | "both" | "none";
export type PinStyle = "dots" | "pins" | "none";
export type Labels = "none" | "names" | "flags";
export type StatKey = "countries" | "percent" | "continents" | "trips";

export interface ShareOptions {
  format: Format;
  theme: ThemeId;
  mapStyle: MapStyle;
  area: Area;
  shade: Shade;
  pinStyle: PinStyle;
  labels: Labels;
  showIdeas: boolean;
  /** "auto" follows the theme, otherwise a colour like #2563eb. */
  been: string;
  idea: string;
  stats: Record<StatKey, boolean>;
  statStyle: "simple" | "board";
  brandPos: "top" | "bottom";
  title: string;
  subtitle: string;
}

export interface SharePlace {
  name: string;
  code: string;
  lat: number;
  lon: number;
  kind: "been" | "idea";
}

export interface ShareData {
  /** Alpha-2 codes of countries you've been to. */
  visited: Set<string>;
  /** Alpha-2 codes of countries you have ideas for but haven't been to. */
  ideaCountries: Set<string>;
  places: SharePlace[];
  stats: Record<StatKey, number>;
  /** The continent with the most countries you've been to, for the "continent" area. */
  continent: string | null;
}

export const FORMATS: Record<Format, { name: string; ratio: string; where: string; h: number; pad: number; gap: number; title: number; sub: number; num: number }> = {
  post: { name: "Post", ratio: "4:5", where: "Instagram feed", h: 675, pad: 32, gap: 16, title: 40, sub: 15, num: 34 },
  square: { name: "Square", ratio: "1:1", where: "Instagram, Facebook", h: 540, pad: 28, gap: 12, title: 30, sub: 14, num: 28 },
  story: { name: "Story", ratio: "9:16", where: "Stories, TikTok", h: 960, pad: 40, gap: 22, title: 54, sub: 17, num: 40 },
  pin: { name: "Pin", ratio: "2:3", where: "Pinterest", h: 810, pad: 36, gap: 20, title: 46, sub: 16, num: 36 },
};

/** The picture is laid out 540 wide and saved at twice that, 1080 pixels across. */
export const CARD_WIDTH = 540;
export const EXPORT_SCALE = 2;

export interface Theme {
  name: string;
  bg: string;
  text: string;
  muted: string;
  land: string;
  line: string;
  been: string;
  idea: string;
  ring: string;
  num: string;
  rule: string;
  tile: string;
  tileLine: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  light: { name: "Light", bg: "#f6f7f5", text: "#1c2421", muted: "#66716c", land: "#dde3df", line: "#a9b4af", been: "#0f766e", idea: "#ea580c", ring: "#ffffff", num: "#0f766e", rule: "#dde3df", tile: "#1c2421", tileLine: "#2c3833" },
  dark: { name: "Dark", bg: "#0f1412", text: "#e7ece9", muted: "#96a29c", land: "#2c3833", line: "#52615a", been: "#2dd4bf", idea: "#fb923c", ring: "#0f1412", num: "#2dd4bf", rule: "#2c3833", tile: "#0a0e0c", tileLine: "#26302c" },
  board: { name: "Departures", bg: "#1c2421", text: "#ffffff", muted: "#96a29c", land: "#2c3833", line: "#52615a", been: "#2dd4bf", idea: "#fb923c", ring: "#1c2421", num: "#2dd4bf", rule: "#2c3833", tile: "#0a0e0c", tileLine: "#26302c" },
  paper: { name: "Passport", bg: "#fbfaf6", text: "#1c2421", muted: "#66716c", land: "#e6ebe7", line: "#a9b4af", been: "#0f766e", idea: "#c2410c", ring: "#fbfaf6", num: "#0f766e", rule: "#dde3df", tile: "#1c2421", tileLine: "#2c3833" },
  teal: { name: "Teal", bg: "#0f766e", text: "#ffffff", muted: "#d5efeb", land: "#3a8f88", line: "#7fbdb6", been: "#ffffff", idea: "#fdba74", ring: "#0f766e", num: "#ffffff", rule: "#3a8f88", tile: "#0a3f3b", tileLine: "#1d5f59" },
};

export const BEEN_SWATCHES = [
  ["#2563eb", "Blue"],
  ["#db2777", "Pink"],
  ["#7c3aed", "Purple"],
  ["#16a34a", "Green"],
  ["#ca8a04", "Mustard"],
] as const;
export const IDEA_SWATCHES = [
  ["#db2777", "Pink"],
  ["#ca8a04", "Mustard"],
  ["#7c3aed", "Purple"],
  ["#dc2626", "Red"],
  ["#0891b2", "Cyan"],
] as const;

/** Rough boxes around each continent, [west, south, east, north], for the continent area. */
const CONTINENT_BOXES: Record<string, [number, number, number, number]> = {
  Europe: [-25, 34, 45, 71],
  Asia: [25, -11, 150, 56],
  Africa: [-20, -36, 53, 38],
  "North America": [-170, 6, -50, 72],
  "South America": [-82, -56, -34, 13],
  Oceania: [110, -48, 180, 0],
  Antarctica: [-180, -90, 180, -60],
};
const WORLD_BOX: [number, number, number, number] = [-180, -56, 180, 84];

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"DM Mono", ui-monospace, Menlo, monospace';

/** Waits for the page's fonts so the first picture isn't drawn in a fallback face. */
export async function loadShareFonts() {
  if (!document.fonts?.load) return;
  await Promise.all(
    [`800 40px ${SANS}`, `600 12px ${SANS}`, `400 15px ${SANS}`, `500 10px ${MONO}`].map((f) => document.fonts.load(f).catch(() => undefined)),
  );
}

export function areaLabel(area: Area, continent: string | null) {
  return area === "world" ? "World" : area === "fit" ? "Best fit" : (continent ?? "Continent");
}

/** The places that go on the picture with these options. */
function shownPlaces(data: ShareData, o: ShareOptions) {
  return data.places.filter((p) => p.kind === "been" || o.showIdeas);
}

/** The part of the world to show, as [west, south, east, north]. */
function viewBox(data: ShareData, o: ShareOptions): [number, number, number, number] {
  if (o.area === "continent" && data.continent && CONTINENT_BOXES[data.continent]) return CONTINENT_BOXES[data.continent];
  if (o.area === "fit") {
    const places = shownPlaces(data, o);
    if (!places.length) return WORLD_BOX;
    let w = Math.min(...places.map((p) => p.lon));
    let e = Math.max(...places.map((p) => p.lon));
    let s = Math.min(...places.map((p) => p.lat));
    let n = Math.max(...places.map((p) => p.lat));
    // A single city still shows the country around it.
    const pad = Math.max(e - w, n - s) * 0.12 + 6;
    const grow = (lo: number, hi: number, min: number) => {
      const extra = Math.max(0, min - (hi - lo)) / 2;
      return [lo - extra - pad, hi + extra + pad];
    };
    [w, e] = grow(w, e, 16);
    [s, n] = grow(s, n, 10);
    return [Math.max(-180, w), Math.max(-80, s), Math.min(180, e), Math.min(85, n)];
  }
  return WORLD_BOX;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** Draws text with extra space between letters, one character at a time (ASCII labels only). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "left") {
  const chars = [...text];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  ctx.textAlign = "left";
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + spacing;
  }
  return width;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function ringsOf(g: Geometry): Position[][] {
  if (g.type === "Polygon") return g.coordinates.flatMap(acrossDateLine);
  if (g.type === "MultiPolygon") return g.coordinates.flat().flatMap(acrossDateLine);
  if (g.type === "GeometryCollection") return g.geometries.flatMap(ringsOf);
  return [];
}

/**
 * Russia, Fiji and Antarctica cross the 180° line, where longitude jumps from 180 to -180. Drawn as is,
 * that jump becomes a line straight across the map and leaves gaps in the land. Instead the ring is
 * kept continuous past 180°, closed along the pole if it goes all the way round (Antarctica), and
 * drawn again one world to the left or right so both sides of the map get their part.
 */
function acrossDateLine(ring: Position[]): Position[][] {
  let shift = 0;
  let crossed = false;
  const out: Position[] = ring.map(([lon, lat], i) => {
    if (i) {
      const d = lon - ring[i - 1][0];
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
      if (d > 180 || d < -180) crossed = true;
    }
    return [lon + shift, lat];
  });
  if (!crossed) return [ring];
  if (shift) {
    // Goes all the way round a pole: finish the shape along it.
    const pole = out.reduce((sum, [, lat]) => sum + lat, 0) < 0 ? -90 : 90;
    out.push([out[out.length - 1][0], pole], [out[0][0], pole]);
  }
  const lons = out.map(([lon]) => lon);
  const lo = Math.min(...lons);
  const hi = Math.max(...lons);
  return [-360, 0, 360].filter((k) => lo + k < 180 && hi + k > -180).map((k) => out.map(([lon, lat]) => [lon + k, lat]));
}

/** A pattern of small dots, used for the dotted map style. */
function dots(ctx: CanvasRenderingContext2D, color: string, gap: number, r: number, scale: number, originX: number, originY: number) {
  const size = Math.max(2, Math.round(gap * scale));
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const t = tile.getContext("2d")!;
  t.fillStyle = color;
  t.beginPath();
  t.arc(size / 2, size / 2, r * scale, 0, Math.PI * 2);
  t.fill();
  const pattern = ctx.createPattern(tile, "repeat")!;
  pattern.setTransform(new DOMMatrix([1 / scale, 0, 0, 1 / scale, originX, originY]));
  return pattern;
}

/** The drop-shaped pin, its point at 0,0, 16 units wide. */
const DROP = new Path2D("M0 0C-1.6-5.2-8-9.4-8-15a8 8 0 1 1 16 0c0 5.6-6.4 9.8-8 15z");

/** Draws the picture onto the canvas, sizing the canvas to fit. */
export function drawShareCard(canvas: HTMLCanvasElement, shapes: CountryShapes | null, data: ShareData, o: ShareOptions, scale = EXPORT_SCALE) {
  const f = FORMATS[o.format];
  const t = THEMES[o.theme];
  const W = CARD_WIDTH;
  const H = f.h;
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const been = o.been === "auto" ? t.been : o.been;
  const idea = o.idea === "auto" ? t.idea : o.idea;

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";
  const inner = W - f.pad * 2;
  let y = f.pad;

  // Wordmark along the top
  if (o.brandPos === "top") {
    ctx.fillStyle = t.text;
    ctx.font = `800 22px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillText("somewhere🎉", f.pad, y + 13);
    ctx.fillStyle = t.muted;
    ctx.font = `500 10px ${MONO}`;
    spaced(ctx, "OUR TRAVEL MAP", W - f.pad, y + 13, 1.4, "right");
    y += 26 + f.gap;
  }

  // Title and the line under it
  ctx.textAlign = "left";
  ctx.font = `800 ${f.title}px ${SANS}`;
  ctx.fillStyle = t.text;
  const titleLines = wrap(ctx, o.title, inner, 2);
  for (const line of titleLines) {
    ctx.fillText(line, f.pad, y + (f.title * 1.05) / 2);
    y += f.title * 1.05;
  }
  ctx.font = `400 ${f.sub}px ${SANS}`;
  ctx.fillStyle = t.muted;
  const subLines = wrap(ctx, o.subtitle, inner, 2);
  if (titleLines.length && subLines.length) y += 6;
  for (const line of subLines) {
    ctx.fillText(line, f.pad, y + (f.sub * 1.35) / 2);
    y += f.sub * 1.35;
  }
  if (titleLines.length || subLines.length) y += f.gap;

  // Work up from the bottom: footer, stats, legend. The map takes the space left in between.
  const stats = (
    [
      ["countries", String(data.stats.countries), "Countries"],
      ["percent", `${data.stats.percent}%`, "Of the world"],
      ["continents", String(data.stats.continents), "Continents"],
      ["trips", String(data.stats.trips), "Trips"],
    ] as const
  ).filter(([key]) => o.stats[key]);
  const board = o.statStyle === "board";
  const cols = o.format === "story" && stats.length >= 3 ? 2 : Math.max(stats.length, 1);
  const rows = Math.ceil(stats.length / cols);
  const tileW = Math.round(f.num * 0.82);
  const tileH = Math.round(f.num * 1.25);
  const numH = board ? tileH : f.num;
  const statsH = stats.length ? 15 + rows * (numH + 8 + 12) + (rows - 1) * 14 : 0;
  // The somewhere.party address is always along the bottom, with the wordmark when it's down there too.
  const footH = o.brandPos === "bottom" ? 26 : 16;
  const showLegend = o.showIdeas && data.places.some((p) => p.kind === "idea") && (o.pinStyle !== "none" || o.shade === "both");
  const legendH = showLegend ? 15 : 0;

  let bottom = H - f.pad;
  const footY = bottom - footH;
  bottom = footY - f.gap;
  const statsY = bottom - statsH;
  if (stats.length) bottom = statsY - f.gap;
  const legendY = bottom - legendH;
  if (showLegend) bottom = legendY - f.gap;

  const map = { x: f.pad, y, w: inner, h: Math.max(40, bottom - y) };
  if (shapes) drawMap(ctx, shapes, data, o, map, t, been, idea, scale);

  if (showLegend) {
    ctx.font = `600 12px ${SANS}`;
    const items: [string, string][] = [
      [been, "Been"],
      [idea, "On standby"],
    ];
    const widths = items.map(([, label]) => 16 + ctx.measureText(label).width);
    let lx = (W - (widths[0] + widths[1] + 18)) / 2;
    items.forEach(([color, label], i) => {
      ctx.fillStyle = color;
      roundRect(ctx, lx, legendY + 2.5, 10, 10, 3);
      ctx.fill();
      ctx.fillStyle = t.muted;
      ctx.textAlign = "left";
      ctx.fillText(label, lx + 16, legendY + 7.5);
      lx += widths[i] + 18;
    });
  }

  if (stats.length) {
    ctx.fillStyle = t.rule;
    ctx.fillRect(f.pad, statsY, inner, 1);
    const colW = (inner - 12 * (cols - 1)) / cols;
    // Each stat is centred in its column, and a short last row is centred under the one above.
    stats.forEach(([, value, label], i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, stats.length - row * cols);
      const rowX = f.pad + (inner - (inRow * colW + 12 * (inRow - 1))) / 2;
      const cx = rowX + (i % cols) * (colW + 12) + colW / 2;
      const cy = statsY + 15 + row * (numH + 8 + 12 + 14);
      if (board) {
        ctx.font = `500 ${Math.round(f.num * 0.8)}px ${MONO}`;
        const tilesX = cx - ([...value].length * (tileW + 3) - 3) / 2;
        [...value].forEach((c, j) => {
          const tx = tilesX + j * (tileW + 3);
          ctx.fillStyle = t.tile;
          roundRect(ctx, tx + 0.5, cy + 0.5, tileW - 1, tileH - 1, 5);
          ctx.fill();
          ctx.strokeStyle = t.tileLine;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText(c, tx + tileW / 2, cy + tileH / 2 + 1);
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.fillRect(tx + 1, cy + tileH / 2, tileW - 2, 1);
        });
      } else {
        ctx.font = `500 ${f.num}px ${MONO}`;
        ctx.fillStyle = t.num;
        ctx.textAlign = "center";
        ctx.fillText(value, cx, cy + f.num / 2);
      }
      ctx.font = `500 10px ${MONO}`;
      ctx.fillStyle = t.muted;
      spaced(ctx, label.toUpperCase(), cx, cy + numH + 8 + 6, 1.4, "center");
    });
  }

  const fy = footY + footH / 2;
  if (o.brandPos === "bottom") {
    ctx.font = `800 22px ${SANS}`;
    ctx.fillStyle = t.text;
    ctx.textAlign = "left";
    ctx.fillText("somewhere🎉", f.pad, fy);
  }
  ctx.font = `500 12px ${MONO}`;
  ctx.fillStyle = t.muted;
  spaced(ctx, "somewhere.party", W - f.pad, fy, 0.7, "right");
}

/** Miller projection's height for a latitude, in the same units as degrees of longitude. */
function miller(lat: number) {
  const phi = (Math.max(-89.9, Math.min(89.9, lat)) * Math.PI) / 180;
  return ((1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi))) * 180) / Math.PI;
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  shapes: CountryShapes,
  data: ShareData,
  o: ShareOptions,
  rect: { x: number; y: number; w: number; h: number },
  t: Theme,
  been: string,
  idea: string,
  scale: number,
) {
  const [west, south, east, north] = viewBox(data, o);
  // The whole world uses the Miller projection, the familiar wall-map shape, which is taller than a
  // flat grid without stretching anything. Smaller areas are a flat grid squashed sideways to suit the
  // middle of the view, so Europe doesn't look stretched.
  const world = o.area === "world";
  const yOf = world ? miller : (lat: number) => lat;
  const c = world ? 1 : Math.cos((((south + north) / 2) * Math.PI) / 180);
  const vbW = (east - west) * c;
  const vbH = yOf(north) - yOf(south);
  const s = Math.min(rect.w / vbW, rect.h / vbH);
  const ox = rect.x + (rect.w - vbW * s) / 2 - west * c * s;
  const oy = rect.y + (rect.h - vbH * s) / 2 + yOf(north) * s;
  const px = (lon: number, lat: number): [number, number] => [ox + lon * c * s, oy - yOf(lat) * s];

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  const land = new Path2D();
  const visited = new Path2D();
  const ideas = new Path2D();
  const shadeBeen = o.shade !== "none";
  const shadeIdeas = o.shade === "both" && o.showIdeas;
  for (const feature of shapes.features) {
    const code = alpha2FromNumeric(String(feature.id));
    const target = code && shadeBeen && data.visited.has(code) ? visited : code && shadeIdeas && data.ideaCountries.has(code) ? ideas : land;
    const path = new Path2D();
    for (const ring of ringsOf(feature.geometry)) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = px(lon, lat);
        if (i) path.lineTo(x, y);
        else path.moveTo(x, y);
      });
      path.closePath();
    }
    target.addPath(path);
    if (target !== land) land.addPath(path);
  }

  const dotted = o.mapStyle === "dotted";
  const outline = o.mapStyle === "outline";
  const paint = (path: Path2D, color: string | null) => {
    if (dotted) {
      ctx.fillStyle = dots(ctx, color ?? t.line, 3.1, 1, scale, rect.x, rect.y);
      ctx.fill(path);
    } else if (outline) {
      if (color) {
        ctx.fillStyle = color;
        ctx.fill(path);
      }
      ctx.strokeStyle = color ?? t.line;
      ctx.lineWidth = 0.55;
      ctx.lineJoin = "round";
      ctx.stroke(path);
    } else {
      ctx.fillStyle = color ?? t.land;
      ctx.fill(path);
    }
  };
  if (dotted) {
    // Dotted shading replaces the grey dots rather than sitting on top of them.
    paint(land, null);
    ctx.fillStyle = t.bg;
    ctx.fill(visited);
    ctx.fill(ideas);
  } else paint(land, null);
  paint(ideas, idea);
  paint(visited, been);

  // Pins, with ideas underneath so the places you've been sit on top.
  const shown = shownPlaces(data, o)
    .map((p) => ({ ...p, xy: px(p.lon, p.lat) }))
    .filter(({ xy: [x, y] }) => x >= rect.x - 10 && x <= rect.x + rect.w + 10 && y >= rect.y - 10 && y <= rect.y + rect.h + 10);
  const ordered = shown.filter((p) => p.kind === "idea").concat(shown.filter((p) => p.kind === "been"));
  for (const p of ordered) {
    const [x, y] = p.xy;
    const color = p.kind === "been" ? been : idea;
    if (o.pinStyle === "dots") {
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = t.ring;
      ctx.lineWidth = 1.05;
      ctx.stroke();
    } else if (o.pinStyle === "pins") {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.48, 0.48);
      ctx.fillStyle = color;
      ctx.fill(DROP);
      ctx.strokeStyle = t.ring;
      ctx.lineWidth = 1.6;
      ctx.stroke(DROP);
      ctx.beginPath();
      ctx.arc(0, -15, 3, 0, Math.PI * 2);
      ctx.fillStyle = t.ring;
      ctx.fill();
      ctx.restore();
    }
  }

  if (o.labels !== "none") drawLabels(ctx, shown, o, rect, t);
  ctx.restore();
}

/**
 * Names next to the pins. Each tries right, left, above and below, and is left off if none of those
 * fit without covering another pin or name. Places far from the crowd get first pick.
 */
function drawLabels(
  ctx: CanvasRenderingContext2D,
  shown: (SharePlace & { xy: [number, number] })[],
  o: ShareOptions,
  rect: { x: number; y: number; w: number; h: number },
  t: Theme,
) {
  const fs = 9;
  const drops = o.pinStyle === "pins";
  const boxes: number[][] = shown.map(({ xy: [x, y] }) => (drops ? [x - 4, y - 11, x + 4, y] : [x - 4, y - 4, x + 4, y + 4]));
  const overlaps = (b: number[]) => boxes.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  const outside = (b: number[]) => b[0] < rect.x || b[1] < rect.y || b[2] > rect.x + rect.w || b[3] > rect.y + rect.h;
  const lonely = shown
    .map((p) => ({ p, d: Math.min(Infinity, ...shown.filter((q) => q !== p).map((q) => Math.hypot(q.xy[0] - p.xy[0], q.xy[1] - p.xy[1]))) }))
    .sort((a, b) => b.d - a.d)
    .map(({ p }) => p);
  // The same city can be both a trip and an idea: name it once.
  const named = new Set<string>();

  ctx.font = `500 ${fs}px ${MONO}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = t.bg;
  ctx.fillStyle = t.text;
  for (const p of lonely) {
    const key = `${p.name}|${p.code}`;
    if (named.has(key)) continue;
    const text = (o.labels === "flags" ? `${flag(p.code)} ` : "") + p.name.toUpperCase();
    const wd = ctx.measureText(text).width;
    const [x, y] = p.xy;
    const ay = drops ? y - 7 : y;
    const g = o.pinStyle === "none" ? 3 : 6;
    const cands = [
      { x: x + g, y: ay, align: "left" as const, b: [x + g, ay - fs / 2, x + g + wd, ay + fs / 2] },
      { x: x - g, y: ay, align: "right" as const, b: [x - g - wd, ay - fs / 2, x - g, ay + fs / 2] },
      { x, y: ay - g - fs / 2, align: "center" as const, b: [x - wd / 2, ay - g - fs, x + wd / 2, ay - g] },
      { x, y: ay + g + fs / 2, align: "center" as const, b: [x - wd / 2, ay + g, x + wd / 2, ay + g + fs] },
    ];
    const hit = cands.find((cand) => !outside(cand.b) && !overlaps(cand.b));
    if (!hit) continue;
    boxes.push(hit.b);
    named.add(key);
    ctx.textAlign = hit.align;
    ctx.strokeText(text, hit.x, hit.y);
    ctx.fillText(text, hit.x, hit.y);
  }
}

/** A short description of the picture for screen readers. */
export function describeCard(data: ShareData, o: ShareOptions) {
  const been = new Set(data.places.filter((p) => p.kind === "been").map((p) => `${p.name}|${p.code}`)).size;
  const ideas = new Set(data.places.filter((p) => p.kind === "idea").map((p) => `${p.name}|${p.code}`)).size;
  return `${o.title}. A map with ${data.visited.size} countries and ${been} places you’ve been${o.showIdeas && ideas ? `, and ${ideas} ideas on standby` : ""}.`;
}
