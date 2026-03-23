// ─── create-ficecal-plugin types ──────────────────────────────────────────────

/**
 * The type of plugin to scaffold.
 *
 * - "billing"  : Adds a billing adapter (BillingAdapterContribution)
 * - "theme"    : Adds a UI theme (ThemeContribution)
 * - "mcp"      : Adds an MCP tool (McpToolContribution)
 * - "full"     : Scaffolds all three contribution types
 */
export type PluginType = "billing" | "theme" | "mcp" | "full";

/**
 * Options collected from the user (via prompts or CLI flags) before scaffolding.
 */
export interface ScaffoldOptions {
  /** npm package name. E.g. "@acme/ficecal-plugin-datadog". */
  packageName: string;

  /** Human-readable display name. E.g. "Datadog Observability Plugin". */
  displayName: string;

  /** Short one-line description for package.json and the plugin manifest. */
  description: string;

  /** Author name or organisation. */
  author: string;

  /** SPDX license identifier. Defaults to "MIT". */
  license: string;

  /** Type of plugin to scaffold. */
  pluginType: PluginType;

  /**
   * Absolute path to the output directory.
   * The scaffold is written into `<outDir>/<packageBaseName>/`.
   */
  outDir: string;
}

/**
 * A single file to be written to disk by the scaffolder.
 */
export interface ScaffoldFile {
  /** Relative path from the plugin root directory. E.g. "src/index.ts". */
  path: string;

  /** UTF-8 file content. */
  content: string;
}

/**
 * The complete scaffold output — a list of files to be written.
 */
export interface ScaffoldOutput {
  /** The resolved directory name (last segment of packageName). */
  dirName: string;

  /** All files to write. */
  files: ScaffoldFile[];
}
