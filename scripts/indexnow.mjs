// Tells Bing and the other IndexNow search engines (Yandex, Seznam, Naver; Bing also feeds DuckDuckGo
// and ChatGPT search) about pages that changed in a push to main, so new blog posts are crawled sooner.
// Run by .github/workflows/indexnow.yml after each push: node scripts/indexnow.mjs <before-sha> <after-sha>.
// Google doesn't use IndexNow; it finds changes through the sitemap and the blog feed.
//
// The key isn't a secret: IndexNow checks it against public/<key>.txt on the site itself.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SITE = "https://somewhere.party";
const KEY = "b598e5946e15e2d56a74c4b5ebcae80a";

const [before, after] = process.argv.slice(2);
if (!after) throw new Error("Usage: node scripts/indexnow.mjs <before-sha> <after-sha>");

// A new branch's first push has no "before"; then just look at the last commit.
const range = /^0+$/.test(before ?? "") || !before ? [`${after}~1`, after] : [before, after];
const changed = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", ...range, "--", "content/blog", "content/destinations", "content/hubs"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.endsWith(".json"));

const published = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8")).published === true;
  } catch {
    return false;
  }
};

const urls = new Set();
for (const file of changed.filter(published)) {
  const slug = file.replace(/^.*\//, "").replace(/\.json$/, "");
  if (file.startsWith("content/blog/")) {
    urls.add(`${SITE}/blog/${slug}`);
    urls.add(`${SITE}/blog`);
  } else urls.add(`${SITE}/destinations/${slug}`);
}
if (urls.size === 0) {
  console.log("No published pages changed.");
  process.exit(0);
}

// The site deploys separately: Cloudflare builds it from the same push and reports back as the
// "Workers Builds" check on the commit. Wait for that check to pass before asking search engines to look.
// (Fetching the pages themselves doesn't work from GitHub: Cloudflare's bot protection challenges it.)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const repo = process.env.GITHUB_REPOSITORY ?? "MattGibbard/NextTrip";
const headers = { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }) };
const deadline = Date.now() + 20 * 60_000;
for (;;) {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${after}/check-runs?per_page=100`, { headers });
  if (!res.ok) console.log(`GitHub answered ${res.status} when asked about the Cloudflare build; trying again.`);
  const build = res.ok ? (await res.json()).check_runs.find((c) => c.name.startsWith("Workers Builds")) : undefined;
  if (build?.status === "completed") {
    if (build.conclusion !== "success") throw new Error(`The site's Cloudflare build ${build.conclusion}, so search engines weren't told.`);
    break;
  }
  if (Date.now() > deadline) throw new Error("The site's Cloudflare build hadn't finished after 20 minutes, so search engines weren't told.");
  await sleep(30_000);
}
// Give Cloudflare's edge a moment to pick up the new version.
await sleep(30_000);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: [...urls] }),
});
console.log(`IndexNow answered ${res.status} for:\n${[...urls].join("\n")}`);
// 200 and 202 both mean it was taken.
if (res.status !== 200 && res.status !== 202) process.exit(1);
