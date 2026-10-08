// Runs before the build. Finds where each destination guide is on the map from its place name and
// country, so nobody has to type coordinates into the editor. Answers are kept in
// content/destinations-geo.json, so each place is only looked up once (or again if its name or
// country changes). A published guide that can't be found stops the build, which leaves the live
// site as it was rather than publishing a guide without a map position or flight time.
import { readdir, readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../content/destinations/", import.meta.url);
const CACHE = new URL("../content/destinations-geo.json", import.meta.url);

const cache = JSON.parse(await readFile(CACHE, "utf8").catch(() => "{}"));
const next = {};
const missing = [];

for (const file of (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort()) {
  const slug = file.replace(/\.json$/, "");
  const guide = JSON.parse(await readFile(new URL(file, DIR), "utf8"));
  const name = String(guide.name ?? "").trim();
  const country = String(guide.country ?? "").trim().toUpperCase();
  if (!name || !/^[A-Z]{2}$/.test(country)) {
    if (guide.published) missing.push(`${slug}: needs a place name and a country`);
    continue;
  }
  const query = `${name}|${country}`;
  if (cache[slug]?.query === query) {
    next[slug] = cache[slug];
    continue;
  }
  const found = (await lookup(name, country, "settlement")) ?? (await lookup(name, country));
  if (found) next[slug] = { query, ...found };
  else if (guide.published) missing.push(`${slug}: couldn't find "${name}" in ${country} on the map`);
}

await writeFile(CACHE, JSON.stringify(next, null, 2) + "\n");
if (missing.length) {
  console.error(`Destination guides that need fixing in the editor:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
const n = Object.keys(next).length;
console.log(`Map positions ready for ${n} destination guide${n === 1 ? "" : "s"}.`);

/** OpenStreetMap's place search, asked politely (one request a second, with a contact address). */
async function lookup(name, country, featureType) {
  await new Promise((r) => setTimeout(r, 1100));
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: name,
    countrycodes: country.toLowerCase(),
    format: "jsonv2",
    limit: "1",
    "accept-language": "en",
    ...(featureType ? { featureType } : {}),
  }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "somewhere.party destination guides (https://somewhere.party)" } });
  if (!res.ok) throw new Error(`Place search failed (${res.status}) looking up ${name}, ${country}`);
  const [hit] = await res.json();
  return hit ? { lat: Math.round(Number(hit.lat) * 1e4) / 1e4, lon: Math.round(Number(hit.lon) * 1e4) / 1e4 } : null;
}
