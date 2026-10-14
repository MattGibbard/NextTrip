// Runs before the build. The footer on every public page links to a few hub pages, picked at random.
// Which hubs are on the site depends on the guides (a hub with no guides is left out), and the
// guides are too big to send to every page, so this keeps just what the links need in
// content/hub-links.json. A hub added or changed in the editor joins at the next build.
import { writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { destinationCards } from "./destination-cards.mjs";

const OUT = new URL("../content/hub-links.json", import.meta.url);

const vite = await createServer({
  configFile: false,
  plugins: [destinationCards()],
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});
try {
  const { HUBS, hubIcon } = await vite.ssrLoadModule("/src/hubs.ts");
  const links = HUBS.map((h) => ({ slug: h.slug, name: h.name, icon: hubIcon(h) }));
  await writeFile(OUT, JSON.stringify(links, null, 2) + "\n");
  console.log(`Footer links ready for ${links.length} hub pages.`);
} finally {
  await vite.close();
}
