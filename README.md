# NextTrip

A private little holiday planner for two, running on Cloudflare Workers with a D1 database.

- **Trips:** every holiday you've been on, with dates, cities, notes, a rating and a cover photo. Each trip has its own page with its route on a map and an Edit button.
- **Places:** a world map of the countries and cities you've visited, with ideas you haven't been to yet shown in orange. Tap a country to see your trips there. It also shows how much of the world and how many continents you've covered, with lists by country, by city and by year.
- **Ideas:** holiday ideas either of you can add, each with one or more places, a budget (£ to £££), trip length, travel time and holiday types. Travel time is worked out from your home (set in Settings) as a rough direct flight, and can't be picked by hand. Each idea can have a cover photo and has its own page with all its details, a map of its places with lines between them (in order for road trips and cruises, otherwise out from the first place), its draw history and an Edit button. You can filter by budget and type.
- **Draw:** start a round and you each get the same number of points (10 by default). You can filter a round by budget, trip length, travel time or type of holiday, so only matching ideas are in it. A round can start with a swipe to shortlist: you each swipe yes or no on every idea, and only the ones you both like go into the draw. Spread your points across those ideas. Each of you also gets one secret veto per round: the other person isn't told and can still put points on that idea, but points on vetoed ideas don't count, and the vetoes are revealed with the results. Points stay hidden until you've both locked in. Then every point is one ticket and the server picks the winner at random. There are no re-rolls, and every draw is kept in the history. Once you've been, the winning idea becomes a trip.
- **Home screen app:** add NextTrip to your phone's home screen and it opens full screen like an app, with its own icon. Settings shows how for your browser.

There's no login yet. Anyone with the link can use the site, and each browser just remembers who you picked (rename yourselves in Settings).

## Running locally

```sh
npm install
npm run db:migrate:local
npm run dev          # http://localhost:5173
npm test             # unit tests for the draw and place search
```

## Deploying to Cloudflare

The simplest route is Cloudflare's Git integration, which deploys on every push.

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Import a repository** and pick this repo.
2. Set the **production branch** to `main` and the **deploy command** to `npm run deploy` (leave the build command empty). If the production branch isn't `main`, merges build but never reach the live site.
3. For pull request previews, set the **non-production branch deploy command** to `npx wrangler preview`. Previews use the `previews` block in `wrangler.jsonc`, which points them at the live database, so changes made in a preview are real.
4. Deploy. On the first deploy, Wrangler creates the `nexttrip` D1 database automatically. The Worker applies any new files in `migrations/` itself on its first request, so there's no separate migration step.

You can also deploy from your machine with `npx wrangler login` followed by `npm run deploy`.

## How it's built

- `worker/index.ts`: the API (Hono) under `/api/*`. Everything else is served as static assets.
- `shared/`: types plus the draw logic (`draw.ts`), shared by the API and the UI.
- `src/`: the React app (Vite). The map uses Leaflet with OpenStreetMap tiles (no API key needed), and city search goes through the Worker to OpenStreetMap's Nominatim.
- `migrations/`: the D1 schema. The Worker applies these automatically, tracked in the same `d1_migrations` table that `wrangler d1 migrations apply` uses.
