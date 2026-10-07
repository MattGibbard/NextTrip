// Runs after `vite build`. Writes the public pages as ready-made HTML so search engines and link
// previews can read them, plus a bare app shell for the private pages, which the Worker serves
// with noindex (worker/pages.ts).
import { readFile, writeFile } from "node:fs/promises";
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
  const { render, headTags } = await vite.ssrLoadModule("/src/prerender.tsx");
  // The build's own title and description give way to each page's.
  const base = shell.replace(/\s*<title>[^<]*<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "");
  if (base === shell || !base.includes('<div id="root"></div>')) throw new Error("index.html doesn't look as expected");

  const pages = { home: "index.html", privacy: "privacy.html", terms: "terms.html", notfound: "404.html" };
  for (const [page, file] of Object.entries(pages)) {
    const html = base
      .replace("</head>", `  ${headTags(page)}\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root" data-page="${page}">${render(page)}</div>`);
    await writeFile(new URL(file, OUT), html);
  }

  await writeFile(
    new URL("shell.html", OUT),
    shell.replace("</head>", `  <meta name="robots" content="noindex" />\n  </head>`),
  );
  console.log(`Prerendered ${Object.keys(pages).length} pages and the app shell.`);
} finally {
  await vite.close();
}
