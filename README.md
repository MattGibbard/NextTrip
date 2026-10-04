# NextTrip

A private little holiday planner for two, running on Cloudflare Workers with a D1 database.

- **Trips:** every holiday you've been on, with dates, cities, notes, a rating and a cover photo.
- **Places:** a world map of the countries and cities you've visited, with ideas you haven't been to yet shown in orange. There's also a list by country or by city.
- **Ideas:** holiday ideas either of you can add, each with one or more places.
- **Draw:** start a round and you each get the same number of points (10 by default). Spread them across the ideas in the pool. Points stay hidden until you've both locked in. Then every point is one ticket and the server picks the winner at random. There are no re-rolls, and every draw is kept in the history. Once you've been, the winning idea becomes a trip.

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
2. Set the **deploy command** to `npm run deploy` (leave the build command empty).
3. Deploy. On the first deploy, Wrangler creates the `nexttrip` D1 database automatically, then applies the migrations in `migrations/`.

You can also deploy from your machine with `npx wrangler login` followed by `npm run deploy`.

If the migration step can't find the database, run `npx wrangler d1 create nexttrip`, paste the `database_id` it prints into `wrangler.jsonc` under `d1_databases`, and deploy again.

## How it's built

- `worker/index.ts`: the API (Hono) under `/api/*`. Everything else is served as static assets.
- `shared/`: types plus the draw logic (`draw.ts`), shared by the API and the UI.
- `src/`: the React app (Vite). The map uses Leaflet with OpenStreetMap tiles (no API key needed), and city search goes through the Worker to OpenStreetMap's Nominatim.
- `migrations/`: the D1 schema.
