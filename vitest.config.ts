import { defineConfig } from "vitest/config";
import { destinationCards } from "./scripts/destination-cards.mjs";

// Kept separate from vite.config.ts so unit tests don't spin up the Workers runtime.
export default defineConfig({
  plugins: [destinationCards()],
  test: { include: ["test/**/*.test.ts"] },
});
