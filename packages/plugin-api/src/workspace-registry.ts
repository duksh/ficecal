// ─── WorkspaceRegistry ─────────────────────────────────────────────────────────
//
// Scopes plugin visibility per workspace.
//
// Context:
//   In multi-tenant FiceCal deployments each request carries a workspaceId
//   (from McpRequestContext.workspaceId). Different workspaces may need
//   different subsets of the globally-registered plugins — e.g. a billing
//   adapter for AWS should not be visible in a workspace that only uses GCP,
//   or a branded theme plugin should only appear in the workspace it belongs to.
//
// Design:
//   WorkspaceRegistry wraps a PluginHost and adds a per-workspace overlay.
//   The global PluginHost remains the source of truth for registration.
//   WorkspaceRegistry adds a "disabled for workspace X" override set on top.
//
//   Effective visibility for (workspaceId, pluginId):
//     1. Plugin must be globally registered and NOT globally disabled.
//     2. Plugin must NOT be in the workspace's override-disabled set.
//
//   This avoids re-registration and keeps a single authoritative registry.
//   Workspace overrides are additive restrictions, never grants — a globally
//   disabled plugin cannot be re-enabled per-workspace.
//
// Hooks fired (through pluginHost.hooks):
//   workspace.plugin.disabled  — { workspaceId, pluginId }
//   workspace.plugin.enabled   — { workspaceId, pluginId }
//
// Phase 8 extension point:
//   "workspace-specific plugin grants" (enabling a plugin for one workspace
//   that is NOT globally registered) is out of scope for Phase 7. It will be
//   added when the plugin registry browser ships, since community plugins need
//   a per-workspace install rather than a global one.
//
// Zero-dependency: imports only from within @ficecal/plugin-api.

import type {
  FicecalPlugin,
  ThemeContribution,
  BillingAdapterContribution,
} from "./types.js";
import type { PluginHost } from "./plugin-host.js";

export class WorkspaceRegistry {
  private readonly _host: PluginHost;

  /**
   * workspaceId → set of pluginIds that are disabled for that workspace.
   * An entry only exists when at least one plugin is overridden for a workspace.
   */
  private readonly _overrides = new Map<string, Set<string>>();

  constructor(host: PluginHost) {
    this._host = host;
  }

  // ─── Plugin visibility ─────────────────────────────────────────────────────

  /**
   * Disable a plugin for a specific workspace.
   *
   * Has no effect if the plugin is already disabled for this workspace.
   * Has no effect on other workspaces.
   * Does NOT affect the global PluginHost state.
   *
   * Fires `workspace.plugin.disabled` action: `{ workspaceId, pluginId }`.
   */
  disablePluginForWorkspace(workspaceId: string, pluginId: string): void {
    if (!this._overrides.has(workspaceId)) {
      this._overrides.set(workspaceId, new Set());
    }
    const disabled = this._overrides.get(workspaceId)!;
    if (!disabled.has(pluginId)) {
      disabled.add(pluginId);
      this._host.hooks.doAction("workspace.plugin.disabled", { workspaceId, pluginId });
    }
  }

  /**
   * Re-enable a workspace-overridden plugin for a specific workspace.
   *
   * Has no effect if the plugin is not currently workspace-disabled.
   * Has no effect on other workspaces.
   * Cannot re-enable a globally disabled plugin.
   *
   * Fires `workspace.plugin.enabled` action: `{ workspaceId, pluginId }`.
   */
  enablePluginForWorkspace(workspaceId: string, pluginId: string): void {
    const disabled = this._overrides.get(workspaceId);
    if (disabled?.has(pluginId)) {
      disabled.delete(pluginId);
      if (disabled.size === 0) {
        // Clean up empty override sets to keep listWorkspaces() accurate
        this._overrides.delete(workspaceId);
      }
      this._host.hooks.doAction("workspace.plugin.enabled", { workspaceId, pluginId });
    }
  }

  /**
   * Returns true if a plugin is visible to a workspace.
   *
   * A plugin is visible when:
   *   - It is globally registered and NOT globally disabled, AND
   *   - It is NOT in this workspace's override-disabled set.
   */
  isPluginEnabledForWorkspace(workspaceId: string, pluginId: string): boolean {
    return (
      this._host.isPluginEnabled(pluginId) &&
      !this._overrides.get(workspaceId)?.has(pluginId)
    );
  }

  /**
   * All plugins visible to a workspace.
   *
   * Excludes:
   *   - Globally disabled plugins (PluginHost.disablePlugin)
   *   - Workspace-overridden disabled plugins
   */
  listPluginsForWorkspace(workspaceId: string): FicecalPlugin[] {
    const workspaceDisabled = this._overrides.get(workspaceId) ?? new Set<string>();
    return this._host
      .listPluginEntries()
      .filter((e) => e.enabled && !workspaceDisabled.has(e.plugin.id))
      .map((e) => e.plugin);
  }

  /**
   * All theme contributions from plugins visible to a workspace.
   *
   * Flat list — deduplication by theme id is the caller's responsibility.
   */
  listThemesForWorkspace(workspaceId: string): ThemeContribution[] {
    return this.listPluginsForWorkspace(workspaceId).flatMap(
      (p) => p.contributions.themes ?? [],
    );
  }

  /**
   * All billing adapter contributions from plugins visible to a workspace.
   */
  listAdaptersForWorkspace(workspaceId: string): BillingAdapterContribution[] {
    return this.listPluginsForWorkspace(workspaceId).flatMap(
      (p) => p.contributions.billingAdapters ?? [],
    );
  }

  // ─── Workspace management ──────────────────────────────────────────────────

  /**
   * Remove all per-workspace overrides for a workspace.
   *
   * After reset the workspace sees the full global plugin set
   * (minus any globally disabled plugins).
   * Does NOT fire hook events — this is a bulk administrative reset.
   */
  resetWorkspace(workspaceId: string): void {
    this._overrides.delete(workspaceId);
  }

  /**
   * Workspace IDs that have at least one plugin override active.
   *
   * Workspaces with no overrides are not tracked and do not appear here —
   * they implicitly see the full global set.
   */
  listWorkspaces(): string[] {
    return [...this._overrides.keys()];
  }

  /**
   * Number of plugins overridden (workspace-disabled) for a workspace.
   * 0 means the workspace sees the full global set.
   */
  overrideCount(workspaceId: string): number {
    return this._overrides.get(workspaceId)?.size ?? 0;
  }
}
