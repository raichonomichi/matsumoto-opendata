import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://modata.raichonomichi.net",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
