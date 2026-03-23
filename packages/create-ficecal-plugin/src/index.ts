// ─── create-ficecal-plugin public API ─────────────────────────────────────────
//
// The public API for programmatic use.
// The CLI entry point is in cli.ts.

export { buildScaffoldFiles, dirName, pluginId } from "./templates.js";
export { scaffold } from "./scaffolder.js";
export type {
  PluginType,
  ScaffoldOptions,
  ScaffoldFile,
  ScaffoldOutput,
} from "./types.js";
