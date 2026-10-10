// Runs before the build. Each guide's "To code" is the airport families fly into, and "Put on
// standby" fills that in as the new idea's arrival. The full airport list is too big to send to
// every browser, so this keeps just the guides' airports in content/destination-airports.json.
// A code that isn't a known airport is only a warning: the guide still publishes, without the
// arrival filled in.
import { readdir, readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../content/destinations/", import.meta.url);
const OUT = new URL("../content/destination-airports.json", import.meta.url);
const rows = JSON.parse(await readFile(new URL("../shared/data/airports.json", import.meta.url), "utf8"));
const byCode = new Map(rows.map((r) => [r[0], r]));

const airports = {};
const unknown = [];
for (const file of (await readdir(DIR)).filter((f) => f.endsWith(".json")).sort()) {
  const guide = JSON.parse(await readFile(new URL(file, DIR), "utf8"));
  const code = String(guide.to_code ?? "").trim().toUpperCase();
  if (!code) continue;
  const row = byCode.get(code);
  if (row) airports[code] = row;
  else if (guide.published) unknown.push(`${file.replace(/\.json$/, "")}: ${code}`);
}

const sorted = Object.fromEntries(Object.entries(airports).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(OUT, JSON.stringify(sorted) + "\n");
if (unknown.length) console.warn(`Guides whose To code isn't an airport, so their arrival won't fill in:\n  ${unknown.join("\n  ")}`);
console.log(`Arrival airports ready for ${Object.keys(sorted).length} destination guides.`);
