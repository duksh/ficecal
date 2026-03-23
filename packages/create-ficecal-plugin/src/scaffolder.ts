// ─── Scaffolder ────────────────────────────────────────────────────────────────
//
// Writes the scaffold files to disk using Node.js `fs/promises`.
// Separated from templates.ts so the pure template functions are easily testable
// without requiring a real filesystem.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildScaffoldFiles, dirName } from "./templates.js";
import type { ScaffoldOptions, ScaffoldOutput } from "./types.js";

/**
 * Writes all scaffold files for the given options to disk.
 *
 * Creates the plugin directory at `<opts.outDir>/<dirName>` and writes all
 * generated files, creating subdirectories as needed.
 *
 * @returns ScaffoldOutput describing what was written.
 */
export async function scaffold(opts: ScaffoldOptions): Promise<ScaffoldOutput> {
  const name = dirName(opts.packageName);
  const pluginDir = join(opts.outDir, name);
  const files = buildScaffoldFiles(opts);

  for (const file of files) {
    const fullPath = join(pluginDir, file.path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, file.content, "utf-8");
  }

  return { dirName: name, files };
}
