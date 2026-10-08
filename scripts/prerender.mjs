// Runs after `vite build`. Writes the public pages as ready-made HTML so search engines and link
// previews can read them, plus a bare app shell for the private pages, which the Worker serves
// with noindex (worker/pages.ts).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const OUT = new URL("../dist/client/", import.meta.url);
const shell = await readFile(new URL("index.html", OUT), "utf8");

const vite = await createServer({
  configFile: false,
  plugins: [react()],
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

try {
  const { render, headTags, pages } = await vite.ssrLoadModule("/src/prerender.tsx");
  // The build's own title and description give way to each page's.
  const base = shell.replace(/\s*<title>[^<]*<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "");
  if (base === shell || !base.includes('<div id="root"></div>')) throw new Error("index.html doesn't look as expected");

  const list = pages();
  for (const { page, file } of list) {
    // Replacer functions, so a "$" in the page's words isn't read as a replacement pattern.
    const html = base
      .replace("</head>", () => `  ${headTags(page)}\n  </head>`)
      .replace('<div id="root"></div>', () => `<div id="root" data-page="${page}">${render(page)}</div>`);
    const out = new URL(file, OUT);
    await mkdir(new URL(".", out), { recursive: true });
    await writeFile(out, html);
  }

  // The sitemap lists every page search engines should find, destination guides included.
  const urls = list.filter((p) => p.index).map((p) => `  <url><loc>https://somewhere.party${p.path}</loc></url>`);
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
