import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Pages are bundled, so import.meta.dirname inside src/lib/data.ts no longer points at src/lib
// at build time. The config is not bundled: fix the data dir here for the whole build.
process.env.CARS_DATA_DIR ||= resolve(import.meta.dirname, "../data/raw");

export default defineConfig({
  // CARS_OUT_DIR lets the build tests write somewhere other than dist/.
  outDir: process.env.CARS_OUT_DIR || "dist",
  vite: { plugins: [tailwindcss()] },
});
