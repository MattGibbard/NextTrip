// Runs after `vite build`. Writes the public pages as ready-made HTML so search engines and link
// previews can read them, plus a bare app shell for the private pages, which the Worker serves
// with noindex (worker/pages.ts).
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { destinationCards } from "./destination-cards.mjs";

const OUT = new URL("../dist/client/", import.meta.url);
const shell = await readFile(new URL("index.html", OUT), "utf8");

/**
 * When a content file last changed, from git, as an ISO date. Unknown when git isn't there or only
 * has the latest commit (a shallow clone would give every page the same date, which would mislead).
 */
function lastChanged(file) {
  if (!file) return undefined;
  try {
    if (execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() !== "false") return undefined;
    const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { encoding: "utf8" }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  } catch {
    return undefined;
  }
}

const vite = await createServer({
  configFile: false,
  plugins: [react(), destinationCards()],
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

try {
  const { render, headTags, pages } = await vite.ssrLoadModule("/src/prerender.tsx");
  // The build's own title and description give way to each page's.
  const base = shell.replace(/\s*<title>[^<]*<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "");
  if (base === shell || !base.includes('<div id="root"></div>')) throw new Error("index.html doesn't look as expected");

  const list = pages().map((p) => ({ ...p, updated: lastChanged(p.source) }));
  for (const { page, file, updated } of list) {
    // Replacer functions, so a "$" in the page's words isn't read as a replacement pattern.
    const html = base
      .replace("</head>", () => `  ${headTags(page, updated)}\n  </head>`)
      .replace('<div id="root"></div>', () => `<div id="root" data-page="${page}">${render(page)}</div>`);
    const out = new URL(file, OUT);
    await mkdir(new URL(".", out), { recursive: true });
    await writeFile(out, html);
  }

  // The sitemap lists every page search engines should find, destination guides included.
  // lastmod tells search engines which pages changed since they last looked.
  const urls = list
    .filter((p) => p.index)
    .map((p) => `  <url><loc>https://somewhere.party${p.path}</loc>${p.updated ? `<lastmod>${p.updated}</lastmod>` : ""}</url>`);
  await writeFile(
    new URL("sitemap.xml", OUT),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
  );

  await writeFile(
    new URL("shell.html", OUT),
    shell.replace("</head>", `  <meta name="robots" content="noindex" />\n  </head>`),
  );
  console.log(`Prerendered ${list.length} pages, the sitemap and the app shell.`);
} finally {
  await vite.close();
}
