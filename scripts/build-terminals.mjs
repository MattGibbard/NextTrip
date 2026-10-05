// Rebuilds the bundled airport and station lists in shared/data from open data:
//   airports: OurAirports (public domain), IATA codes for airports with scheduled flights
//   stations: Trainline's open stations list (ODbL), UK CRS codes and Benerail codes elsewhere in Europe
// Run with: node scripts/build-terminals.mjs
import { writeFileSync } from "node:fs";

const AIRPORTS = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv";
const STATIONS = "https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv";

/** Parses CSV with quoted fields into objects keyed by the header row. */
function parseCsv(text, sep = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) row.push(field), (field = "");
    else if (ch === "\n") row.push(field), rows.push(row), (row = []), (field = "");
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const round = (n) => Math.round(Number(n) * 10000) / 10000;

async function airports() {
  const rows = parseCsv(await (await fetch(AIRPORTS)).text());
  const seen = new Set();
  return rows
    .filter((r) => /^[A-Z]{3}$/.test(r.iata_code) && r.scheduled_service === "yes" && /_airport$/.test(r.type) && r.type !== "closed_airport")
    .sort((a, b) => ["large_airport", "medium_airport", "small_airport"].indexOf(a.type) - ["large_airport", "medium_airport", "small_airport"].indexOf(b.type))
    .filter((r) => !seen.has(r.iata_code) && seen.add(r.iata_code))
    .map((r) => [r.iata_code, r.name.replace(/\s+(International\s+)?Airport$/i, "").trim() || r.name, r.municipality, r.iso_country, round(r.latitude_deg), round(r.longitude_deg)]);
}

async function stations() {
  const rows = parseCsv(await (await fetch(STATIONS)).text(), ";");
  const seen = new Set();
  return rows
    .filter((r) => r.latitude && r.longitude)
    .flatMap((r) => {
      const code = r.country === "GB" ? r.atoc_id : r.is_suggestable === "t" ? r.benerail_id : "";
      if (!code || seen.has(code)) return [];
      seen.add(code);
      return [[code, r.name, "", r.country, round(r.latitude), round(r.longitude)]];
    });
}

const [a, s] = await Promise.all([airports(), stations()]);
writeFileSync(new URL("../shared/data/airports.json", import.meta.url), JSON.stringify(a));
writeFileSync(new URL("../shared/data/stations.json", import.meta.url), JSON.stringify(s));
console.log(`${a.length} airports, ${s.length} stations`);
