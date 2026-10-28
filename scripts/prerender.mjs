// Runs after `vite build`. Writes the public pages as ready-made HTML so search engines and link
// previews can read them, plus a bare app shell for the private pages, which the Worker serves
// with noindex (worker/pages.ts).
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
  const { render, headTags, pages, feed } = await vite.ssrLoadModule("/src/prerender.tsx");
  // The build's own title and description give way to each page's.
  const base = shell.replace(/\s*<title>[^<]*<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "");
  if (base === shell || !base.includes('<div id="root"></div>')) throw new Error("index.html doesn't look as expected");

  // The site's stylesheet goes inside each page rather than as a separate file, so the page can draw
  // as soon as its HTML arrives instead of waiting on a second download. (The app shell keeps the link.)
  // A page whose code loads on its own (see lazyView) links its own styles too, so it's styled before
  // that code arrives; the same link then stops the code fetching them twice.
  const cssLink = shell.match(/\s*<link rel="stylesheet"[^>]*href="(\/assets\/index-[\w-]+\.css)"[^>]*>/);
  if (!cssLink) throw new Error("index.html has no stylesheet link to put inside the pages");
  const css = (await readFile(new URL(`.${cssLink[1]}`, OUT), "utf8")).replaceAll("</style", "<\\/style");
  const assets = await readdir(new URL("assets/", OUT));
  const ownStyles = (name) => {
    const file = assets.find((f) => f.startsWith(`${name}-`) && f.endsWith(".css"));
    if (!file) throw new Error(`No ${name} styles in the build`);
    return `\n    <link rel="stylesheet" crossorigin href="/assets/${file}">`;
  };
  // The home page's own styles go inside it like the site's, so the first page most people see doesn't wait on them.
  const inlineStyles = async (name) => {
    const file = assets.find((f) => f.startsWith(`${name}-`) && f.endsWith(".css"));
    if (!file) throw new Error(`No ${name} styles in the build`);
    return `<style>${(await readFile(new URL(`assets/${file}`, OUT), "utf8")).replaceAll("</style", "<\\/style")}</style>`;
  };
  const pageStyles = { home: await inlineStyles("HomePage"), how: ownStyles("HowItWorks"), picker: ownStyles("HolidayPicker") };
  const pageStyle = (page) => pageStyles[page.startsWith("pick:") || page === "reveal" ? "picker" : page] ?? "";
  // The Guides pages' code (every guide's card) loads on its own too, so those pages start fetching it
  // alongside the site's own code instead of after it.
  const guidesCode = assets.find((f) => f.startsWith("GuideView-") && f.endsWith(".js"));
  if (!guidesCode) throw new Error("No Guides code in the build");
  const guidePage = (page) => page === "destinations" || page.startsWith("destination:");
  // Pages with the hero boarding pass fetch its airport-code font straight away, so the codes don't
  // jump when it arrives late (PageSpeed's "layout shift culprits").
  const passPage = (page) => page === "home" || page === "creators";
  const preload = (page) =>
    (guidePage(page) ? `\n    <link rel="modulepreload" crossorigin href="/assets/${guidesCode}">` : "") +
    (passPage(page) ? `\n    <link rel="preload" href="/fonts/dm-mono-500-latin.woff2" as="font" type="font/woff2" crossorigin>` : "");
  const styled = (page) => base.replace(cssLink[0], () => `\n    <style>${css}</style>${pageStyle(page)}${preload(page)}`);

  const list = pages().map((p) => ({ ...p, updated: gitDate(p.source), published: gitDate(p.source, true) }));
  for (const { page, file, updated, published } of list) {
    // Replacer functions, so a "$" in the page's words isn't read as a replacement pattern.
    const html = styled(page)
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

  // When each public page first appeared, for the owner's stats page to show how new pages are doing.
  await writeFile(
    new URL("page-dates.json", OUT),
    JSON.stringify(list.filter((p) => p.index && p.published).map((p) => ({ path: p.path, published: p.published }))),
  );

  // The blog's RSS feed, for feed readers and search engines.
  await mkdir(new URL("blog/", OUT), { recursive: true });
  await writeFile(new URL("blog/feed.xml", OUT), feed());

  await writeFile(
    new URL("shell.html", OUT),
    shell.replace("</head>", `  <meta name="robots" content="noindex" />\n  </head>`),
  );
  console.log(`Prerendered ${list.length} pages, the sitemap, the blog feed and the app shell.`);
} finally {
  await vite.close();
}
