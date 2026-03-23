import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // VITE_BASE_URL is injected by CI (configure-pages outputs the correct
  // base path, e.g. /ficecal/). Local dev leaves it unset → defaults to "/"
  // so the dev server is completely unaffected.
  base: process.env.VITE_BASE_URL ?? "/",
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    // Allow TypeScript source imports from workspace packages
    conditions: ["import", "default"],
  },
});
