// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://bip110.org",
  trailingSlash: "ignore",
  integrations: [react()],

  vite: {
    optimizeDeps: {
      include: ["react-dom/client"],
    },
    plugins: [tailwindcss()],
  },
});
