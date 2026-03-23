// ─── FiceCal Plugin API — type contracts ──────────────────────────────────────
//
// Zero-dependency. All contribution point types live here.
// Compatible with @ficecal/mcp-tooling types via structural typing (no import).

import type { FicecalPluginManifest } from "./manifest.js";

// ─── Theme contribution ────────────────────────────────────────────────────────

/**
 * A visual theme contributed by a plugin.
 *
 * Tokens are CSS custom properties (--fc-*) applied to `document.documentElement`.
 * Built-in themes (light / dark) are themselves plugin contributions — no special casing.
 *
 * WordPress analogy: this is the Theme API equivalent.
 */
export interface ThemeContribution {
  /** Unique theme id. Convention: kebab-case, e.g. "high-contrast", "ocean-blue". */
  id: string;
  /** Display name shown in the theme picker. */
  displayName: string;
  /** Optional longer description. */
  description?: string;
  /**
   * Complete set of --fc-* CSS custom property tokens for this theme.
   * Must supply all tokens expected by the FiceCal design system.
   */
  tokens: Record<string, string>;
  /** HEX swatch colour shown in the theme picker preview row. */
  previewSwatch?: string;
}

// ─── Billing contribution ──────────────────────────────────────────────────────

/** A normalised cloud billing line item — common shape across providers. */
export interface BillingLineItem {
  /** Provider service name, e.g. "AmazonBedrock", "compute.googleapis.com". */
  service: string;
  /** Provider-specific SKU or rate code. */
  sku?: string;
  usageType?: string;
  /** Billed cost in billingCurrency. */
  cost: number;
  /** ISO 4217 currency code. */
  currency: string;
  /** ISO date "YYYY-MM-DD" — period start. */
  startDate: string;
  /** ISO date "YYYY-MM-DD" — period end (exclusive). */
  endDate: string;
  /** Resource tags for cost allocation. */
  tags?: Record<string, string>;
}

/**
 * A normalised billing period summary — the canonical fixture shape.
 * Adapters parse provider-specific exports into this shape.
 */
export interface BillingPeriodSummary {
  /** Provider identifier matching the plugin's provider field. */
  provider: string;
  accountId?: string;
  billingPeriodStart: string;  // ISO date
  billingPeriodEnd: string;    // ISO date
  totalCost: number;
  currency: string;
  lineItems: BillingLineItem[];
  /** Provider-specific metadata (account alias, project name, etc.). */
  metadata?: Record<string, string>;
}

/**
 * A billing fixture contributed by a plugin.
 *
 * `data` holds the normalised BillingPeriodSummary.
 * `rawFormat` documents the original provider export format this was sourced from.
 * `version` enables fixture parity checks across CI runs.
 */
export interface BillingFixtureContribution {
  /** Provider identifier, e.g. "aws", "gcp", "azure", "openai". */
  provider: string;
  /** Fixture schema version — increment when fixture shape changes. */
  version: string;
  /** Original provider export format (for documentation / future parsers). */
  rawFormat:
    | "cost-explorer"
    | "gcp-billing-export"
    | "azure-cost-management"
    | "openai-usage-export";
  data: BillingPeriodSummary;
}

/**
 * A billing adapter contributed by a plugin.
 *
 * `ingestMode`:
 * - "deterministic" — returns data from a registered fixture (Phase 6)
 * - "live"          — calls provider SDK (Phase 7+); returns 501 until implemented
 */
export interface BillingAdapterContribution {
  provider: string;
  ingestMode: "deterministic" | "live";
  load(periodStart: string, periodEnd: string): Promise<BillingPeriodSummary>;
}

// ─── UI panel contribution ─────────────────────────────────────────────────────

/**
 * A UI panel section contributed by a plugin.
 * Typed generically (component: unknown) so plugin-api has zero React dependency.
 * The app shell casts to the appropriate React component type at render time.
 */
export interface UiPanelContribution {
  /** Unique panel id. */
  id: string;
  /** Display name shown in NavBar link. */
  displayName: string;
  /** HTML id for the anchor section — used by NavBar IntersectionObserver. */
  anchorId: string;
  /** The React component (unknown to keep plugin-api dependency-free). */
  component: unknown;
  /** Optional keyboard shortcut (e.g. "Alt+B") to focus this panel. */
  shortcut?: string;
}

// ─── Economics engine contribution ────────────────────────────────────────────

/**
 * A custom economics computation engine contributed by a plugin.
 * Used to register alternative or extended computation modules.
 */
export interface EconomicsEngineContribution {
  /** Unique engine id, e.g. "gpu-economics-v2". */
  id: string;
  displayName: string;
  version: string;
  compute(input: unknown): Promise<unknown>;
}

// ─── MCP tool — minimal compatible shape ──────────────────────────────────────

/**
 * Minimal MCP tool shape — structurally compatible with McpToolDescriptor
 * from @ficecal/mcp-tooling but avoids a hard import dependency.
 *
 * Consumers with access to @ficecal/mcp-tooling can pass McpToolDescriptor
 * instances directly; TypeScript's structural typing ensures compatibility.
 */
export interface PluginMcpTool {
  id: string;
  name: string;
  description: string;
  namespace: string;
  stability: "stable" | "beta" | "experimental";
  inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[] };
  handler(envelope: { context: unknown; input: unknown }): Promise<unknown>;
}

// ─── Plugin contribution points ───────────────────────────────────────────────

/**
 * The full set of contribution points available to a FiceCal plugin.
 * Each field is optional — a plugin only needs to contribute what it extends.
 */
export interface FicecalPluginContributions {
  /** Visual themes contributed by this plugin. */
  themes?: ThemeContribution[];
  /** MCP tool descriptors contributed by this plugin. */
  mcpTools?: PluginMcpTool[];
  /** Billing data adapters (deterministic or live). */
  billingAdapters?: BillingAdapterContribution[];
  /** Deterministic billing fixture datasets. */
  billingFixtures?: BillingFixtureContribution[];
  /** UI panels (React components). */
  uiPanels?: UiPanelContribution[];
  /** Economics computation engines. */
  economicsEngines?: EconomicsEngineContribution[];
}

// ─── The plugin interface ──────────────────────────────────────────────────────

/**
 * The FiceCal plugin interface.
 *
 * A plugin is a self-contained bundle that extends FiceCal's capabilities
 * without modifying core. Plugins declare a manifest and a set of contribution
 * points. The PluginHost routes each contribution to the appropriate registry.
 *
 * WordPress analogy: every theme and plugin implements this interface.
 * Built-in capabilities (light/dark theme, economics tools) are themselves
 * plugins — no special-casing in core.
 */
export interface FicecalPlugin {
  /** Unique plugin id. Convention: "@ficecal/<name>" for core, "ficecal-<name>" for community. */
  id: string;
  /** Human-readable plugin name. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Optional description surfaced in plugin listings. */
  description?: string;
  /**
   * Feature flag keys that must be active for this plugin to load.
   * Unmet requirements cause the PluginHost to skip registration.
   */
  requires?: string[];
  /** The contribution points this plugin provides. */
  contributions: FicecalPluginContributions;
  /**
   * Optional structured manifest for community plugins (non-@ficecal/* ids).
   * When present, PluginHost validates it at registration time via
   * validatePluginManifest(). Core plugins from @ficecal/* are exempt.
   */
  manifest?: FicecalPluginManifest;
}

// ─── Feature flag descriptor ──────────────────────────────────────────────────

/**
 * Descriptor for a named feature flag.
 *
 * Declared via PluginHost.declareFeatureFlag() so the admin panel can list
 * all known flags (even inactive ones) with human-readable metadata.
 */
export interface FeatureFlagDescriptor {
  /** Flag key used in plugin `requires` arrays and PluginHost constructor. */
  key: string;
  /** Human-readable label for the admin control panel. */
  displayName: string;
  /** Optional longer description shown in tooltips / help text. */
  description?: string;
  /**
   * Delivery phase this flag was introduced in.
   * Informational only — shown in the admin panel.
   * e.g. "Phase 1", "Phase 7"
   */
  phase?: string;
}

// ─── Plugin entry (for admin listings) ────────────────────────────────────────

/**
 * A plugin with its runtime enabled/disabled state.
 * Returned by PluginHost.listPluginEntries() for the admin panel plugin manager.
 */
export interface PluginEntry {
  plugin: FicecalPlugin;
  /** True unless disablePlugin() has been called for this plugin's id. */
  enabled: boolean;
}

// ─── Plugin registration errors ───────────────────────────────────────────────

export type PluginErrorCode =
  | "DUPLICATE_PLUGIN"
  | "DUPLICATE_THEME"
  | "DUPLICATE_BILLING_ADAPTER"
  | "DUPLICATE_BILLING_FIXTURE"
  | "UNMET_REQUIREMENTS"
  | "INVALID_THEME_TOKENS"
  | "MANIFEST_INVALID";   // Phase 11: community plugin manifest failed validatePluginManifest()

export class PluginRegistrationError extends Error {
  constructor(
    public readonly code: PluginErrorCode,
    message: string,
    public readonly pluginId: string,
  ) {
    super(message);
    this.name = "PluginRegistrationError";
  }
}
