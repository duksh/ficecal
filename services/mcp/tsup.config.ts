import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/server.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    bundle: true,
    // Cloud SDK packages use dynamic imports — keep them external so optional
    // live-mode deps don't bloat the bundle when unused in fixture mode.
    external: [
        "@aws-sdk/client-cost-explorer",
        "@google-cloud/bigquery",
        "@azure/identity",
    ],
    noExternal: [
        // Bundle all @ficecal/* workspace packages (they export .ts sources directly)
        /^@ficecal\//,
    ],
    clean: true,
    sourcemap: false,
    // Inline JSON fixtures into the bundle (avoids import-attribute issues on Node 22+)
    loader: { ".json": "json" },
});
