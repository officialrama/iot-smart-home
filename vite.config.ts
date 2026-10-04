import { defineConfig } from "vite";

// base "./" agar hasil build bisa ditaruh di subfolder mana pun (S3, GitHub Pages, dsb).
export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 900 }
});
