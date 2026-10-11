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

// The site is built from a shallow clone (Cloudflare's builds fetch only the latest commit), which
// can't say when anything changed. Fetch the rest of the history first: commits and file lists only,
// no file contents, so it's quick. If that fails, pages go out without dates rather than wrong ones.
function fullHistory() {
  try {
    if (execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "false") return true;
    execFileSync("git", ["fetch", "--unshallow", "--filter=blob:none", "--quiet"], { stdio: "ignore", timeout: 60_000 });
    return execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "false";
  } catch {
    return false;
  }
}
const history = fullHistory();
if (!history) console.warn("No git history, so pages and the sitemap go out without dates.");

/** A git date for a content file, as an ISO date: the latest change, or with `first`, when it was added. */
function gitDate(file, first = false) {
  if (!file || !history) return undefined;
  try {
    const out = execFileSync("git", ["log", ...(first ? ["--no-renames", "--diff-filter=A"] : ["-1"]), "--format=%cs", "--", file], { encoding: "utf8" }).trim();
    const date = out.split("\n").pop();
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

  const list = pages().map((p) => ({ ...p, updated: gitDate(p.source), published: gitDate(p.source, true) }));
  for (const { page, file, updated, published } of list) {
    // Replacer functions, so a "$" in the page's words isn't read as a replacement pattern.
    const html = base
      .replace("</head>", () => `  ${headTags(page, updated, published)}\n  </head>`)
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
