import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  // The world map data is its own lazy-loaded chunk and is large by nature.
  build: { chunkSizeWarningLimit: 800 },
});
