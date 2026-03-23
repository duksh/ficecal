// ─── PluginHost ────────────────────────────────────────────────────────────────
//
// Routes plugin contributions to the appropriate sub-registries.
// Accepts a McpToolRegistrar interface so this package stays zero-dependency.
//
// Phase 7 additions:
//   - HookRegistry wired in as `host.hooks` — plugins and core use it to
//     communicate through filter/action chains instead of direct calls.
//   - Runtime feature flag management: declareFeatureFlag / enableFeatureFlag /
//     disableFeatureFlag / listFeatureFlags.  Flags are now mutable at runtime
//     so the admin control panel can toggle them without a full restart.
//   - Plugin enable/disable: disablePlugin / enablePlugin / listPluginEntries.
//     Disabling is "soft" — contributions remain in sub-registries (themes,
//     billing adapters stay registered) but the plugin is marked inactive in
//     the admin panel and hook listeners it registered can check plugin state.

import type { FicecalPlugin, FeatureFlagDescriptor, PluginEntry } from "./types.js";
import { PluginRegistrationError } from "./types.js";
import { ThemeRegistry } from "./theme-registry.js";
import { BillingRegistry } from "./billing-registry.js";
import { HookRegistry } from "./hook-registry.js";
import { validatePluginManifest, ManifestValidationError } from "./manifest.js";
import { PluginSandbox } from "./sandbox.js";

/**
 * Minimal MCP tool registrar interface.
 * Structurally compatible with McpToolRegistry from @ficecal/mcp-tooling.
 * Kept here as an interface to avoid importing that package.
 */
export interface McpToolRegistrar {
  register(tool: unknown): void;
}

/**
 * Central registration host for FiceCal plugins.
 *
 * Usage:
 * ```ts
 * const host = new PluginHost(mcpToolRegistry, ["commitment-management"]);
 *
 * // Declare known feature flags for the admin panel
 * host.declareFeatureFlag({
 *   key: "commitment-management",
 *   displayName: "Commitment Management",
 *   phase: "Phase 1",
 * });
 *
 * // Register plugins
 * host.register(lightThemePlugin);
 * host.register(awsBillingPlugin);
 *
 * // Inspect via admin panel APIs
 * host.listPluginEntries();      // [{ plugin, enabled }]
 * host.listFeatureFlags();       // [{ key, displayName, active }]
 *
 * // Toggle at runtime (admin panel control surface)
 * host.disablePlugin("ficecal-dark-theme");
 * host.enableFeatureFlag("shared-cost-allocation");
 * ```
 *
 * The PluginHost:
 * - Validates plugin id uniqueness
 * - Checks feature flag requirements at registration time
 * - Routes each contribution to the correct sub-registry
 * - Exposes a HookRegistry for filter/action chains (Phase 7)
 * - Provides runtime enable/disable for plugins and feature flags
 * - Provides listing APIs for the admin panel
 */
export class PluginHost {
  private readonly _plugins = new Map<string, FicecalPlugin>();
  private readonly _disabledPlugins = new Set<string>();
  private readonly _hardDisabledPlugins = new Set<string>();
  private readonly _knownFlags = new Map<string, FeatureFlagDescriptor>();
  private readonly _activeFlags: Set<string>;

  readonly themes = new ThemeRegistry();
  readonly billing = new BillingRegistry();

  /**
   * The HookRegistry for this plugin host.
   *
   * Core and plugins use this to communicate through filter/action chains:
   *   host.hooks.addFilter("billing.estimate.actual.result", myTransform);
   *   host.hooks.doAction("plugin.registered", plugin);
   */
  readonly hooks = new HookRegistry();

  private readonly _mcpTools: McpToolRegistrar;
  private readonly _sandbox: PluginSandbox | null;

  constructor(
    mcpTools: McpToolRegistrar,
    activeFeatureFlags: string[] = [],
    sandbox: PluginSandbox | null = null,
  ) {
    this._mcpTools = mcpTools;
    this._activeFlags = new Set(activeFeatureFlags);
    this._sandbox = sandbox;
  }

  /** The PluginSandbox wired at construction time (null if none). */
  get sandbox(): PluginSandbox | null {
    return this._sandbox;
  }

  // ─── Plugin registration ───────────────────────────────────────────────────

  /**
   * Register a plugin and route its contributions.
   *
   * Throws PluginRegistrationError if:
   * - A plugin with the same id is already registered
   * - The plugin's required feature flags are not all active
   * - Any contribution registration fails (duplicate theme, adapter, etc.)
   *
   * Fires the `plugin.registered` action after successful registration.
   */
  register(plugin: FicecalPlugin): void {
    if (this._plugins.has(plugin.id)) {
      throw new PluginRegistrationError(
        "DUPLICATE_PLUGIN",
        `Plugin "${plugin.id}" is already registered.`,
        plugin.id,
      );
    }

    // ── Community plugin manifest validation (P2/P3) ──────────────────────────
    // Core plugins from @ficecal/* are trusted. Community plugins must carry a
    // valid manifest when running in guarded environments. If the plugin provides
    // a manifest (optional), always validate it regardless of origin.
    const isCommunityPlugin = !plugin.id.startsWith("@ficecal/");
    if (plugin.manifest !== undefined) {
      try {
        validatePluginManifest(plugin.manifest);
      } catch (err) {
        if (err instanceof ManifestValidationError) {
          throw new PluginRegistrationError(
            "MANIFEST_INVALID",
            `Plugin "${plugin.id}" has an invalid manifest: ${err.message}`,
            plugin.id,
          );
        }
        throw err;
      }
    } else if (isCommunityPlugin) {
      // Community plugins without manifests are allowed (backward-compatible)
      // but emit a hook notification so the admin panel can flag them.
      this.hooks.doAction("plugin.unverified", plugin.id);
    }

    // Feature flag guard — checked against current active flag set
    for (const flag of plugin.requires ?? []) {
      if (!this._activeFlags.has(flag)) {
        throw new PluginRegistrationError(
          "UNMET_REQUIREMENTS",
          `Plugin "${plugin.id}" requires feature flag "${flag}" which is not active.`,
          plugin.id,
        );
      }
    }

    // Record the plugin
    this._plugins.set(plugin.id, plugin);

    // Route contributions to sub-registries
    for (const theme of plugin.contributions.themes ?? []) {
      this.themes.register(theme, plugin.id);
    }
    for (const tool of plugin.contributions.mcpTools ?? []) {
      this._mcpTools.register(tool);
    }
    for (const fixture of plugin.contributions.billingFixtures ?? []) {
      this.billing.registerFixture(fixture, plugin.id);
    }
    for (const adapter of plugin.contributions.billingAdapters ?? []) {
      // ── Sandbox wrapping (P2) ──────────────────────────────────────────────
      // When a PluginSandbox is active, wrap the adapter's load() so any
      // timeout or unhandled error is caught and re-thrown as SandboxViolationError.
      // Core plugins (@ficecal/*) are sandboxed too — defence in depth.
      const sandboxedAdapter =
        this._sandbox !== null
          ? {
              ...adapter,
              load: (start: string, end: string) =>
                this._sandbox!.execute(
                  () => adapter.load(start, end),
                  { pluginId: plugin.id, operationName: `billing.load(${adapter.provider})` },
                ),
            }
          : adapter;

      this.billing.registerAdapter(sandboxedAdapter, plugin.id);
    }

    // Fire hook — plugins and core can react to new registrations
    this.hooks.doAction("plugin.registered", plugin);
  }

  getPlugin(id: string): FicecalPlugin | undefined {
    return this._plugins.get(id);
  }

  /** All registered plugins (enabled and disabled). */
  listPlugins(): FicecalPlugin[] {
    return [...this._plugins.values()];
  }

  get pluginCount(): number {
    return this._plugins.size;
  }

  // ─── Plugin enable / disable ───────────────────────────────────────────────

  /**
   * Soft-disable a registered plugin.
   *
   * The plugin's contributions remain in their sub-registries (themes still
   * apply, billing adapters still load), but the plugin is marked as disabled
   * in listPluginEntries() — the admin panel reflects this state.
   *
   * Fires the `plugin.disabled` action.
   *
   * @throws Error if no plugin with `id` is registered.
   */
  disablePlugin(id: string): void {
    if (!this._plugins.has(id)) {
      throw new Error(`Cannot disable unknown plugin "${id}".`);
    }
    if (!this._disabledPlugins.has(id)) {
      this._disabledPlugins.add(id);
      this.hooks.doAction("plugin.disabled", id);
    }
  }

  /**
   * Re-enable a previously disabled plugin.
   *
   * Fires the `plugin.enabled` action.
   *
   * @throws Error if no plugin with `id` is registered.
   */
  enablePlugin(id: string): void {
    if (!this._plugins.has(id)) {
      throw new Error(`Cannot enable unknown plugin "${id}".`);
    }
    if (this._disabledPlugins.has(id)) {
      this._disabledPlugins.delete(id);
      this.hooks.doAction("plugin.enabled", id);
    }
  }

  /** True if the plugin is registered and NOT in the disabled set. */
  isPluginEnabled(id: string): boolean {
    return this._plugins.has(id) && !this._disabledPlugins.has(id);
  }

  /**
   * Hard-disable a registered plugin.
   *
   * Unlike `disablePlugin()` (soft-disable), this method:
   * 1. Marks the plugin as disabled in `listPluginEntries()` (soft-disable side effects).
   * 2. Removes all themes this plugin contributed from the ThemeRegistry.
   * 3. Removes all billing fixtures and adapters this plugin contributed from BillingRegistry.
   * 4. Fires the `plugin.hard-disabled` hook action.
   *
   * This is a one-way operation — re-enabling via `enablePlugin()` will not restore
   * the removed contributions. The plugin must be re-registered to restore them.
   *
   * @throws Error if no plugin with `id` is registered.
   */
  hardDisablePlugin(id: string): void {
    if (!this._plugins.has(id)) {
      throw new Error(`Cannot hard-disable unknown plugin "${id}".`);
    }
    // Soft-disable side effects (marks in _disabledPlugins, fires plugin.disabled)
    this.disablePlugin(id);
    // Remove contributions from sub-registries
    this.themes.unregisterByPlugin(id);
    this.billing.unregisterByPlugin(id);
    // Track hard-disabled state
    this._hardDisabledPlugins.add(id);
    // Fire hard-disabled hook
    this.hooks.doAction("plugin.hard-disabled", id);
  }

  /**
   * Returns true if the plugin has been hard-disabled via `hardDisablePlugin()`.
   * A hard-disabled plugin has had its contributions removed from all sub-registries.
   */
  isHardDisabled(id: string): boolean {
    return this._hardDisabledPlugins.has(id);
  }

  /**
   * All registered plugins with their enabled/disabled state.
   * This is the primary data source for the admin panel plugin manager.
   */
  listPluginEntries(): PluginEntry[] {
    return [...this._plugins.values()].map((plugin) => ({
      plugin,
      enabled: !this._disabledPlugins.has(plugin.id),
    }));
  }

  // ─── Feature flag management ───────────────────────────────────────────────

  /**
   * Declare a feature flag so it appears in the admin control panel.
   *
   * Flags passed to the constructor are auto-active but unknown to the admin
   * panel unless declared. Call declareFeatureFlag() for each flag you want
   * to appear in the admin UI, regardless of whether it starts active.
   *
   * Example:
   * ```ts
   * host.declareFeatureFlag({
   *   key: "commitment-management",
   *   displayName: "Commitment Management",
   *   description: "Enable RI/SP commitment tracking panels and MCP tools.",
   *   phase: "Phase 1",
   * });
   * ```
   */
  declareFeatureFlag(descriptor: FeatureFlagDescriptor): void {
    this._knownFlags.set(descriptor.key, descriptor);
  }

  /**
   * Activate a feature flag at runtime.
   *
   * Note: plugins that were rejected at registration time due to an unmet
   * requirement are NOT retroactively re-registered. Enabling a flag only
   * affects subsequent register() calls and runtime flag checks.
   *
   * Fires the `featureflag.changed` action with `{ key, active: true }`.
   */
  enableFeatureFlag(key: string): void {
    if (!this._activeFlags.has(key)) {
      this._activeFlags.add(key);
      this.hooks.doAction("featureflag.changed", { key, active: true });
    }
  }

  /**
   * Deactivate a feature flag at runtime.
   *
   * Plugins already registered with this flag as a requirement remain
   * registered — disabling a flag is not a retroactive unload.
   *
   * Fires the `featureflag.changed` action with `{ key, active: false }`.
   */
  disableFeatureFlag(key: string): void {
    if (this._activeFlags.has(key)) {
      this._activeFlags.delete(key);
      this.hooks.doAction("featureflag.changed", { key, active: false });
    }
  }

  /** True if the feature flag is currently active. */
  isFeatureFlagActive(key: string): boolean {
    return this._activeFlags.has(key);
  }

  /**
   * All declared feature flags with their current active state.
   * This is the primary data source for the admin feature control panel.
   *
   * Only flags registered via declareFeatureFlag() appear here.
   * Use isFeatureFlagActive() for programmatic checks.
   */
  listFeatureFlags(): Array<FeatureFlagDescriptor & { active: boolean }> {
    return [...this._knownFlags.values()].map((descriptor) => ({
      ...descriptor,
      active: this._activeFlags.has(descriptor.key),
    }));
  }
}
