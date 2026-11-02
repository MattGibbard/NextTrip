# Writing blog posts

The rules for every post in `content/blog`, used by the daily blog run. Posts go live without a human check, so follow them strictly. `test/blog.test.ts` enforces the mechanical ones (links, tags, airport codes, table cells, cover files); the rest are on the writer.

## Choosing topics

- Read [blog-topics.md](blog-topics.md) for what exists. Never repeat or closely overlap an existing post, or another post in the same run.
- Each run writes 2 or 3 posts:
  - **At least one practical airport or flight post** (themes a, c, d, j or k). These reach Google page 1 fastest. Prefer an airport not yet covered for that question.
  - **Most days, one seasonal post** for whatever falls 6 to 10 weeks ahead (winter and February half-term angles from mid-October to early December, Easter in January and February, summer in March and April, October half-term in July and August).
  - **The rest** from the other themes, rotating. Never two posts from the same niche theme (g to p) in one run, and not the same niche theme as the previous run.
- Prefer topics that link naturally to several existing guides.

### Don't compete with hub pages

Never write a post whose main search phrase a hub targets. Check the `title` and `seo_title` of the files in `content/hubs` and the old addresses in `content/site/redirects.json`. That rules out broad posts like "where is hot in <month>", "where to go in <month>", "<half term> holidays", "where to go for New Year's Eve", Christmas holiday or Christmas sun roundups, and quiet or relaxing holidays. Narrower angles a hub doesn't answer are fine (airport + month + flight time, a comparison between two places). Link the hub instead of duplicating it. Extra material for a hub's search belongs in that hub; mention it in the PR body rather than writing a post.

### Themes

- **a.** "Where can you fly direct from <airport>?" for the main UK and Irish airports: destinations, airlines, flight times, seasonal routes, linking our guides.
- **c.** Best side of the plane for a specific route or approach, framed as guidance not a guarantee (runway, wind, weather, direction).
- **d.** "How early should you arrive at <airport>?": by airline, hand vs hold luggage, short vs long-haul, peak times, transport, linking the airport's official guidance. Say rules change and to check with the airport or airline.
- **e.** Best destinations or a plan for an N-day trip (3-day European breaks, weekends with direct flights from the UK, a country in 4 days): weigh flight time, transfers, size and realistic sightseeing time.
- **f.** Own ideas likely to reach page 1 for a small new site: long-tail questions with clear intent and weak competition, tied to deciding where to go and planning the trip.
- **g.** Alternatives to X: quieter swaps for crowded places, favouring swaps we have guides for.
- **h.** Quietest time to visit X: crowd patterns, school holidays, cruise-ship days and events, with weather trade-offs.
- **i.** X or Y comparisons between two of our guides.
- **j.** Direct flights from smaller UK and Irish airports (Exeter, Southampton, Norwich, Inverness, Belfast City, Cardiff, Bournemouth, Cork, Shannon). Routes change often; verify carefully.
- **k.** Airport + month + flight time, e.g. "Sun within 3 hours of Birmingham in May": checked direct routes plus climate data for the month.
- **l.** No jet lag: warm places on UK time or within an hour of it, with the time difference and when each is warm.
- **m.** Group logistics: splitting costs between families, trips with grandparents. somewhere.party fits naturally here.
- **n.** Holidays for travellers who want different things (one hates heat, one hates flying, beach vs city).
- **o.** By train or ferry from the UK. Check current operators and routes.
- **p.** Cool summers: places that usually stay under 25°C in August, from historical climate data.

## The JSON file

One file per post: `content/blog/<slug>.json`, slug = the main search phrase in lowercase-hyphens. Copy the shape of an existing post (see `src/blog.ts`):

- `published` true, `title`, `date` today (YYYY-MM-DD). Leave `updated` out on new posts.
- `author`: "Matt" or "Brogan", picked at random per post. Never name the author in the text.
- `tags`: 1 to 4 slugs from `BLOG_TAGS` in `src/blogTags.ts` that genuinely fit. Never invent tags; tag consistently with similar posts.
- `intro`: 1 or 2 sentences.
- `seo_title`: under ~60 characters, includes the target phrase, and hints at the answer or shows the year, e.g. "Manchester Airport: arrive 2 or 3 hours before? (2026)".
- `seo_description`: under ~155 characters and opens with the answer itself, e.g. "About 2 hours before short-haul and 3 before long-haul…".
- `sections` [{heading, text}] and `faqs` [{question, answer}] with 3 to 5 real searched questions. Text uses short paragraphs, "- " lists, **bold** and [links](/path).
- About 900 to 1500 words.

### Airport field

A post about a single UK or Irish airport (arrival times, direct flights, terminals and similar) sets a top-level `"airport"` to that airport's code, e.g. `"MAN"` (London City is `"LCY"`), placed as in `content/blog/how-early-should-you-arrive-at-liverpool-airport.json`. Allowed codes are the GB and IE rows in `shared/mainAirports.ts`. Slugs starting `how-early-should-you-arrive-at-` or `where-can-you-fly-direct-from-` must have one, so only write those for listed airports. All other posts leave the field out. The field adds a "Where could you go from <airport>?" departures board.

Airport and flight posts don't bring sign-ups on their own, so each ends with a short "Where could you go from <airport>?" section linking 3 or more fitting guides or hubs, plus `/how-to-decide-where-to-go-on-holiday` or a natural mention of the draw.

## Links

- Internal links must be real pages: `/`, `/destinations`, `/blog`, `/blog/<slug>`, `/how-to-decide-where-to-go-on-holiday`, `/destinations/<guide slug>` (published, in `content/destinations`), `/destinations/<hub slug>` (`content/hubs`).
- Link 3 or more relevant guides or hubs per post, and other posts where it helps. Guide pages list the posts that link to them, and booking tiles are built from the cover guide and linked guides, so linking real guides matters.
- Never link to a `from` address in `content/site/redirects.json`; link to where it redirects.
- External links only to official sources (airports, airlines, government).

## Photos

### Cover

- Default: `cover` = the slug of a published guide with an image whose photo suits the post. Check its `image_alt`. Ideally the post links to it, and it differs from recent covers in [blog-topics.md](blog-topics.md). If left out, the first linked guide's photo is used.
- Only when no guide photo fits (airports, planes, packing, money, apps): a custom photo. Set `cover_image` to `/images/blog/<file>` and `cover_image_alt` to a plain, factual description, and leave out `cover`.

### Section photos

Sections that link a guide get its photo automatically. Where no guide fits, a post may have **at most one** custom section photo, using the section fields `image` (`/images/blog/<file>.webp`), `image_alt` and `image_caption`.

### Getting a custom photo from Pixabay

1. Search `https://pixabay.com/api/?key=$PIXABAY_API_KEY&q=<topic>&image_type=photo&orientation=horizontal&safesearch=true&per_page=50`.
2. Pick a relevant landscape photo with no watermark and no people as the subject, and not used by a recent post. Look at the image itself before using it.
3. Download its `largeImageURL` (never hotlink). If the file comes back as "Rate limit exceeded" text, wait about 10 seconds and retry.
4. Convert to WebP, 1280px wide, quality 80, with sharp (run node from the repo folder), saved as `public/images/blog/<topic>-<pixabayId>_1280.webp`. No credit needed.

## Readability

1. The first section is headed exactly "The short answer", with 3 to 5 "- " bullets. Where the points are numbers, write "**Label:** short value" with the value under 28 characters (e.g. "**Long-haul:** 3 hours"); these show as chips. Extra lines go in a paragraph after the bullets.
2. One or two paragraphs per post start with "Tip:", "Watch out:" or "Local knowledge:", never two in a row. Each holds a real, checked fact.
3. When three or more items share the same two or three facts, use a table: each row on its own line as "| a | b |", heading row first, every row with the same number of cells. Every airport and plane-side post has at least one.
4. Never more than three plain paragraphs in a row without a list, box, table or photo between them.

## Quality

- Must not read as scaled AI content: real substance, specific checked facts, genuine comparisons and rankings. No filler intros or "in conclusion". Each post gets its own research.
- Verify changeable facts (routes, airlines, airport advice, dates, prices) with web search. If something can't be verified, leave it out or phrase it carefully ("usually", "check the current timetable"). Never invent routes, airlines or numbers. Say when routes or advice were checked where it matters.
- British English, friendly plain voice like the existing posts. Titles and SEO titles never mention kids or children. No posts about UK holiday destinations (UK airports as departure points are fine).
- Mention somewhere.party (ideas list, points, the draw) only where it fits naturally.
- Before committing, re-read each post as a sceptical editor and cut anything unverified, repetitive or generic.

## Refreshing an old post

Posts with time-sensitive content (routes, airlines, arrival advice, terminals, timetables, prices, "new for <year>" lists, a year in the title) are due a refresh when their `updated` date (or `date`) is more than about 3 months old. Refresh the oldest due post: re-check its changeable facts, correct or remove anything out of date, update years and "checked in <month year>" wording, and set `updated` to today. Don't change its slug, date, author or tags unless a tag is plainly wrong. Never bump `updated` without actually re-checking.
