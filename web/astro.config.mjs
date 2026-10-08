import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Pages are bundled, so import.meta.dirname inside src/lib/data.ts no longer points at src/lib
// at build time. The config is not bundled: fix the data dirs here for the whole build.
process.env.CARS_DATA_DIR ||= resolve(import.meta.dirname, "../data/raw");
process.env.CARS_IMAGES_DIR ||= resolve(import.meta.dirname, "../data/images");

export default defineConfig({
  // Production domain (ADR-0009): canonical URLs are built from it.
  site: "https://siete3.com",
  vite: {
    plugins: [tailwindcss()],
    // `data/images/` lives outside web/ (ADR-0012); components glob it through this alias.
    resolve: { alias: { "@images": process.env.CARS_IMAGES_DIR } },
  },
});
