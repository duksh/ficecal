// ─── AdminPanel ────────────────────────────────────────────────────────────────
//
// Phase 8 — The FiceCal admin control surface.
//
// Four sections:
//   1. Feature Control Panel  — toggle runtime feature flags (commitment-management,
//      shared-cost-allocation, live-billing, workspace-scoping …)
//   2. Plugin Manager         — list all registered plugins, enable / disable them
//      at runtime; shows contribution point counts per plugin.
//   3. Billing Provider Status — readyProviders, registered fixtures and adapters;
//      reflects what's live in the client-side BillingRegistry.
//   4. Registry Browser       — browse community plugins from duksh/ficecal-plugin-registry;
//      shows install readiness, tags, version, author; uses RegistryClient.
//
// Architecture:
//   AdminPanel receives PluginHost and reads initial state from it.
//   It subscribes to host.hooks actions (plugin.enabled, plugin.disabled,
//   featureflag.changed) to stay reactive without polling.
//   All mutations go through PluginHost methods which fire the hooks —
//   the UI stays in sync automatically.
//
// WordPress analogy:
//   This is wp-admin → Plugins + Settings + Plugin Directory combined.

import { useState, useEffect, useCallback } from "react";
import type { PluginHost, PluginEntry, FicecalPlugin } from "@ficecal/plugin-api";
import { RegistryClient } from "@ficecal/plugin-registry-client";
import type { PluginManifest, InstallReadinessResult } from "@ficecal/plugin-registry-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdateStatus = "up-to-date" | "update-available" | "unknown";

// ─── U6: Numeric semver comparison ────────────────────────────────────────────
// Returns positive if a > b, negative if a < b, 0 if equal.
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface PluginUpdateInfo {
  status: UpdateStatus;
  registryVersion?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCorePlugin(plugin: FicecalPlugin): boolean {
  return plugin.id.startsWith("@ficecal/");
}

/** Returns "verified" | "unverified" | "core" for the given plugin. */
function pluginVerificationStatus(plugin: FicecalPlugin): "verified" | "unverified" | "core" {
  if (isCorePlugin(plugin)) return "core";
  return plugin.manifest !== undefined ? "verified" : "unverified";
}

/** Category filter buttons for P7 Registry Browser. */
const REGISTRY_CATEGORIES = ["All", "Billing", "Theme", "Economics", "Integration"] as const;

function contributionSummary(plugin: FicecalPlugin): string {
  const parts: string[] = [];
  const c = plugin.contributions;
  if (c.themes?.length) parts.push(`${c.themes.length} theme${c.themes.length > 1 ? "s" : ""}`);
  if (c.mcpTools?.length) parts.push(`${c.mcpTools.length} MCP tool${c.mcpTools.length > 1 ? "s" : ""}`);
  if (c.billingFixtures?.length) parts.push(`${c.billingFixtures.length} fixture${c.billingFixtures.length > 1 ? "s" : ""}`);
  if (c.billingAdapters?.length) parts.push(`${c.billingAdapters.length} adapter${c.billingAdapters.length > 1 ? "s" : ""}`);
  if (c.uiPanels?.length) parts.push(`${c.uiPanels.length} panel${c.uiPanels.length > 1 ? "s" : ""}`);
  if (c.economicsEngines?.length) parts.push(`${c.economicsEngines.length} engine${c.economicsEngines.length > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "No contributions";
}

// ─── Toggle component ─────────────────────────────────────────────────────────

interface ToggleProps {
  on: boolean;
  disabled?: boolean;
  onToggle(): void;
  label: string;
}

function Toggle({ on, disabled, onToggle, label }: ToggleProps) {
  return (
    <button
      className={`admin-toggle ${on ? "admin-toggle--on" : "admin-toggle--off"} ${disabled ? "admin-toggle--disabled" : ""}`}
      onClick={disabled ? undefined : onToggle}
      aria-pressed={on}
      aria-label={label}
      title={disabled ? "Core plugins cannot be disabled" : label}
      type="button"
    >
      <span className="admin-toggle-track">
        <span className="admin-toggle-knob" />
      </span>
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  pluginHost: PluginHost;
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────

export function AdminPanel({ pluginHost }: Props) {
  // ── State — initialised from pluginHost, kept in sync via hooks ────────────

  const [pluginEntries, setPluginEntries] = useState<PluginEntry[]>(
    () => pluginHost.listPluginEntries(),
  );
  const [featureFlags, setFeatureFlags] = useState(
    () => pluginHost.listFeatureFlags(),
  );
  const [billingReady] = useState(() => pluginHost.billing.readyProviders);
  const [billingFixtures] = useState(() => pluginHost.billing.listFixtures());
  const [billingAdapters] = useState(() => pluginHost.billing.listAdapters());

  // ── Registry browser state (Section 4) ────────────────────────────────────
  const [registryClient] = useState(() => new RegistryClient());
  const [registryPlugins, setRegistryPlugins] = useState<PluginManifest[]>([]);
  const [registryReadiness, setRegistryReadiness] = useState<Map<string, InstallReadinessResult>>(new Map());
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [registrySearch, setRegistrySearch] = useState("");
  const [registryTagFilter, setRegistryTagFilter] = useState("");
  const [registryTags, setRegistryTags] = useState<string[]>([]);
  // P7: Category filter for Registry Browser
  const [registryCategoryFilter, setRegistryCategoryFilter] = useState<string>("All");
  // P7: "View Details" expansion state — tracks which plugin ids are expanded
  const [expandedPluginIds, setExpandedPluginIds] = useState<Set<string>>(new Set());

  // ── U6: Update checker state ───────────────────────────────────────────────
  const [updateCheckResults, setUpdateCheckResults] = useState<Map<string, PluginUpdateInfo>>(new Map());
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);

  // ── Subscribe to hook events so the panel is reactive ─────────────────────

  useEffect(() => {
    const syncPlugins = () => setPluginEntries(pluginHost.listPluginEntries());
    const syncFlags  = () => setFeatureFlags(pluginHost.listFeatureFlags());

    pluginHost.hooks.addAction("plugin.enabled",    syncPlugins);
    pluginHost.hooks.addAction("plugin.disabled",   syncPlugins);
    pluginHost.hooks.addAction("plugin.registered", syncPlugins);
    pluginHost.hooks.addAction("featureflag.changed", syncFlags);

    return () => {
      pluginHost.hooks.removeAction("plugin.enabled",    syncPlugins);
      pluginHost.hooks.removeAction("plugin.disabled",   syncPlugins);
      pluginHost.hooks.removeAction("plugin.registered", syncPlugins);
      pluginHost.hooks.removeAction("featureflag.changed", syncFlags);
    };
  }, [pluginHost]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handlePluginToggle(entry: PluginEntry) {
    if (isCorePlugin(entry.plugin)) return; // core plugins are immutable
    if (entry.enabled) {
      pluginHost.disablePlugin(entry.plugin.id);
    } else {
      pluginHost.enablePlugin(entry.plugin.id);
    }
    // State update comes through hooks — no manual setState needed here
  }

  function handleFlagToggle(key: string, active: boolean) {
    if (active) {
      pluginHost.disableFeatureFlag(key);
    } else {
      pluginHost.enableFeatureFlag(key);
    }
  }

  // ── Registry browser handlers ───────────────────────────────────────────────

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    setRegistryError(null);
    try {
      await registryClient.refresh();
      const tags = await registryClient.listTags();
      setRegistryTags(tags);
      const plugins = await registryClient.browse({
        search: registrySearch || undefined,
        tag: registryTagFilter || undefined,
      });
      setRegistryPlugins(plugins);
      // compute readiness for all results
      const readiness = new Map<string, InstallReadinessResult>();
      for (const p of plugins) {
        readiness.set(p.id, registryClient.checkReadiness(p));
      }
      setRegistryReadiness(readiness);
      setRegistryLoaded(true);
    } catch (err) {
      setRegistryError(
        err instanceof Error ? err.message : "Failed to load registry"
      );
    } finally {
      setRegistryLoading(false);
    }
  }, [registryClient, registrySearch, registryTagFilter]);

  const applyRegistryFilters = useCallback(async () => {
    if (!registryLoaded) return;
    setRegistryLoading(true);
    try {
      const plugins = await registryClient.browse({
        search: registrySearch || undefined,
        tag: registryTagFilter || undefined,
      });
      setRegistryPlugins(plugins);
      const readiness = new Map<string, InstallReadinessResult>();
      for (const p of plugins) {
        readiness.set(p.id, registryClient.checkReadiness(p));
      }
      setRegistryReadiness(readiness);
    } catch (err) {
      setRegistryError(err instanceof Error ? err.message : "Filter failed");
    } finally {
      setRegistryLoading(false);
    }
  }, [registryClient, registryLoaded, registrySearch, registryTagFilter]);

  // ── U6: Check for plugin updates ───────────────────────────────────────────

  const handleCheckForUpdates = useCallback(async () => {
    setUpdateCheckLoading(true);
    const results = new Map<string, PluginUpdateInfo>();
    const communityEntries = pluginEntries.filter((e) => !isCorePlugin(e.plugin));
    await Promise.allSettled(
      communityEntries.map(async (entry) => {
        try {
          const manifest = await registryClient.find(entry.plugin.id);
          if (!manifest) {
            results.set(entry.plugin.id, { status: "unknown" });
          } else {
            // Simple semver-like comparison
            const registryVersion = manifest.version;
            const installedVersion = entry.plugin.version;
            const isNewer = compareVersions(registryVersion, installedVersion) > 0;
            results.set(entry.plugin.id, {
              status: isNewer ? "update-available" : "up-to-date",
              registryVersion,
            });
          }
        } catch {
          results.set(entry.plugin.id, { status: "unknown" });
        }
      })
    );
    setUpdateCheckResults(results);
    setUpdateCheckLoading(false);
  }, [pluginEntries, registryClient]);

  // ── P7: Toggle plugin card expansion ──────────────────────────────────────

  function togglePluginExpand(pluginId: string) {
    setExpandedPluginIds((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }

  // ── P7: Category filter — constants defined at module scope, referenced here

  function matchesCategory(plugin: PluginManifest, category: string): boolean {
    if (category === "All") return true;
    const cat = category.toLowerCase();
    return plugin.tags?.some((t) => t.toLowerCase() === cat) ?? false;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const enabledCount  = pluginEntries.filter((e) => e.enabled).length;
  const disabledCount = pluginEntries.length - enabledCount;
  const activeFlags   = featureFlags.filter((f) => f.active).length;

  return (
    <div className="panel-stack">

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="admin-header">
        <div className="admin-header-meta">
          <span className="admin-stat">{pluginEntries.length} plugin{pluginEntries.length !== 1 ? "s" : ""}</span>
          <span className="admin-stat-sep">·</span>
          <span className="admin-stat">{enabledCount} enabled</span>
          {disabledCount > 0 && (
            <>
              <span className="admin-stat-sep">·</span>
              <span className="admin-stat admin-stat--warn">{disabledCount} disabled</span>
            </>
          )}
          <span className="admin-stat-sep">·</span>
          <span className="admin-stat">{activeFlags} / {featureFlags.length} flags active</span>
        </div>
        <p className="hint">
          Changes take effect immediately — no restart required.
          Core plugins (<code>@ficecal/*</code>) cannot be disabled.
        </p>
      </div>

      {/* ── 1. Feature Control Panel ────────────────────────────────────── */}
      <section className="panel" aria-label="Feature control panel">
        <h2>Feature Control Panel</h2>
        <p className="hint admin-section-desc">
          Toggle runtime feature flags. Disabling a flag does not unload plugins
          that have already loaded — restart the app to fully unload.
        </p>

        {featureFlags.length === 0 ? (
          <p className="hint" style={{ color: "var(--fc-text-muted)" }}>
            No feature flags declared — add <code>host.declareFeatureFlag(…)</code> to register flags.
          </p>
        ) : (
          <ul className="admin-flag-list">
            {featureFlags.map((flag) => (
              <li key={flag.key} className="admin-flag-item">
                <div className="admin-flag-body">
                  <div className="admin-flag-title-row">
                    <span className="admin-flag-name">{flag.displayName}</span>
                    {flag.phase && (
                      <span className="admin-phase-tag">{flag.phase}</span>
                    )}
                    <span className={`admin-status-dot ${flag.active ? "admin-status-dot--on" : "admin-status-dot--off"}`}
                      title={flag.active ? "Active" : "Inactive"} />
                  </div>
                  {flag.description && (
                    <p className="admin-flag-desc">{flag.description}</p>
                  )}
                  <code className="admin-flag-key">{flag.key}</code>
                </div>
                <Toggle
                  on={flag.active}
                  onToggle={() => handleFlagToggle(flag.key, flag.active)}
                  label={flag.active ? `Disable ${flag.displayName}` : `Enable ${flag.displayName}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 2. Plugin Manager ───────────────────────────────────────────── */}
      <section className="panel" aria-label="Plugin manager">
        <h2>Plugin Manager</h2>
        <p className="hint admin-section-desc">
          All registered plugins and their contribution points. Community plugins
          installed from the registry (Phase 8) appear here automatically.
        </p>

        {pluginEntries.length === 0 ? (
          <p className="hint" style={{ color: "var(--fc-text-muted)" }}>
            No plugins registered.
          </p>
        ) : (
          <ul className="admin-plugin-list">
            {pluginEntries.map((entry) => {
              const isCore = isCorePlugin(entry.plugin);
              return (
                <li
                  key={entry.plugin.id}
                  className={`admin-plugin-item ${!entry.enabled ? "admin-plugin-item--disabled" : ""}`}
                >
                  <div className="admin-plugin-meta">
                    <div className="admin-plugin-title-row">
                      <span className="admin-plugin-name">{entry.plugin.name}</span>
                      <span className="admin-plugin-version">v{entry.plugin.version}</span>
                      {isCore && (
                        <span className="admin-badge admin-badge--core">Core</span>
                      )}
                      {!entry.enabled && (
                        <span className="admin-badge admin-badge--disabled">Disabled</span>
                      )}
                      {/* U5: 3-state verified badges */}
                      {isCore && (
                        <span
                          className="admin-badge"
                          title="Core plugin — no manifest required"
                          style={{ fontSize: "0.72rem", color: "var(--fc-text-muted)", background: "var(--fc-surface, #f1f5f9)" }}
                        >
                          🛡 Core
                        </span>
                      )}
                      {!isCore && entry.plugin.manifest !== undefined && (
                        <span
                          className="admin-badge admin-badge--ready"
                          title="Verified — manifest validated"
                          style={{ fontSize: "0.72rem" }}
                        >
                          🛡 Verified
                        </span>
                      )}
                      {!isCore && entry.plugin.manifest === undefined && (
                        <span
                          className="admin-badge"
                          title="Unverified community plugin — no manifest"
                          style={{
                            fontSize: "0.72rem",
                            background: "var(--fc-warn-bg, #fefce8)",
                            color: "var(--fc-warn, #92400e)",
                            border: "1px solid var(--fc-warn, #f59e0b)",
                          }}
                        >
                          ⚠ Unverified
                        </span>
                      )}
                    </div>
                    {entry.plugin.description && (
                      <p className="admin-plugin-desc">{entry.plugin.description}</p>
                    )}
                    <div className="admin-plugin-contributions">
                      <span className="admin-contributions-label">
                        {contributionSummary(entry.plugin)}
                      </span>
                    </div>
                    {entry.plugin.requires && entry.plugin.requires.length > 0 && (
                      <div className="admin-plugin-requires">
                        <span className="admin-requires-label">Requires: </span>
                        {entry.plugin.requires.map((flag) => (
                          <code key={flag} className={`admin-flag-chip ${pluginHost.isFeatureFlagActive(flag) ? "admin-flag-chip--met" : "admin-flag-chip--unmet"}`}>
                            {flag}
                          </code>
                        ))}
                      </div>
                    )}
                    <code className="admin-plugin-id">{entry.plugin.id}</code>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", alignItems: "flex-end" }}>
                    <Toggle
                      on={entry.enabled}
                      disabled={isCore}
                      onToggle={() => handlePluginToggle(entry)}
                      label={entry.enabled ? `Disable ${entry.plugin.name}` : `Enable ${entry.plugin.name}`}
                    />
                    {/* U4: Hard Disable — only for enabled community plugins */}
                    {!isCore && entry.enabled && (
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            pluginHost.hardDisablePlugin(entry.plugin.id);
                            setPluginEntries(pluginHost.listPluginEntries());
                          } catch { /* already disabled or not found */ }
                        }}
                        title="Hard disable — removes all contributions from registries"
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.15rem 0.5rem",
                          border: "1px solid var(--fc-crit, #ef4444)",
                          borderRadius: "0.25rem",
                          background: "none",
                          color: "var(--fc-crit, #ef4444)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Hard Disable
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── U6: Check for Updates ────────────────────────────────────── */}
        {pluginEntries.some((e) => !isCorePlugin(e.plugin)) && (
          <div className="admin-update-checker" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--fc-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Community Plugin Updates</span>
              <button
                type="button"
                className="admin-registry-load-btn"
                onClick={handleCheckForUpdates}
                disabled={updateCheckLoading}
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}
              >
                {updateCheckLoading ? "Checking…" : "Check for Updates"}
              </button>
            </div>
            {updateCheckResults.size > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {pluginEntries
                  .filter((e) => !isCorePlugin(e.plugin))
                  .map((entry) => {
                    const info = updateCheckResults.get(entry.plugin.id);
                    if (!info) return null;
                    return (
                      <li key={entry.plugin.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                        <code style={{ fontSize: "0.78rem" }}>{entry.plugin.id}</code>
                        <span style={{ color: "var(--fc-text-muted)" }}>v{entry.plugin.version}</span>
                        {info.status === "up-to-date" && (
                          <span style={{ color: "var(--fc-ok)", fontWeight: 600 }}>Up to date</span>
                        )}
                        {info.status === "update-available" && (
                          <span style={{ color: "var(--fc-accent, #3b82f6)", fontWeight: 600 }}>
                            Update available: v{info.registryVersion}
                          </span>
                        )}
                        {info.status === "unknown" && (
                          <span style={{ color: "var(--fc-text-muted)" }}>Unknown</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── 3. Billing Provider Status ──────────────────────────────────── */}
      <section className="panel" aria-label="Billing provider status">
        <h2>Billing Provider Status</h2>
        <p className="hint admin-section-desc">
          Providers with both a fixture and an adapter registered are{" "}
          <strong>ready</strong>. Live adapters (Phase 7+) require a registered
          adapter with <code>ingestMode: "live"</code>.
        </p>

        {billingFixtures.length === 0 && billingAdapters.length === 0 ? (
          <p className="hint" style={{ color: "var(--fc-text-muted)" }}>
            No billing plugins loaded in this runtime. Install a billing adapter
            plugin to enable cost ingestion.
          </p>
        ) : (
          <ul className="admin-billing-list">
            {/* Collect all unique providers across fixtures and adapters */}
            {Array.from(
              new Set([
                ...billingFixtures.map((f) => f.provider),
                ...billingAdapters.map((a) => a.provider),
              ]),
            ).map((provider) => {
              const hasFixture = billingFixtures.some((f) => f.provider === provider);
              const adapter    = billingAdapters.find((a) => a.provider === provider);
              const isReady    = billingReady.includes(provider);
              return (
                <li key={provider} className="admin-billing-item">
                  <div className="admin-billing-provider">
                    <span
                      className={`admin-ready-dot ${isReady ? "admin-ready-dot--ready" : "admin-ready-dot--pending"}`}
                      title={isReady ? "Ready" : "Incomplete — missing fixture or adapter"}
                    />
                    <span className="admin-billing-name">{provider.toUpperCase()}</span>
                    {isReady && (
                      <span className="admin-badge admin-badge--ready">Ready</span>
                    )}
                  </div>
                  <div className="admin-billing-details">
                    <span className={`admin-billing-detail ${hasFixture ? "admin-billing-detail--ok" : "admin-billing-detail--missing"}`}>
                      {hasFixture ? "✓" : "✗"} Fixture
                    </span>
                    <span className={`admin-billing-detail ${adapter ? "admin-billing-detail--ok" : "admin-billing-detail--missing"}`}>
                      {adapter ? "✓" : "✗"} Adapter
                    </span>
                    {adapter && (
                      <span className="admin-billing-mode">
                        {adapter.ingestMode === "live" ? "🔴 live" : "📁 deterministic"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Hook system status */}
        <div className="admin-hooks-status">
          <p className="admin-hooks-title">Hook Registry</p>
          <div className="admin-hooks-row">
            <span className="admin-hooks-stat">
              {pluginHost.hooks.registeredFilters.length} filter hook{pluginHost.hooks.registeredFilters.length !== 1 ? "s" : ""}
            </span>
            <span className="admin-hooks-sep">·</span>
            <span className="admin-hooks-stat">
              {pluginHost.hooks.registeredActions.length} action hook{pluginHost.hooks.registeredActions.length !== 1 ? "s" : ""}
            </span>
          </div>
          {pluginHost.hooks.registeredFilters.length > 0 && (
            <div className="admin-hooks-names">
              {pluginHost.hooks.registeredFilters.map((name) => (
                <code key={name} className="admin-hook-chip">{name}</code>
              ))}
            </div>
          )}
          {pluginHost.hooks.registeredActions.length > 0 && (
            <div className="admin-hooks-names">
              {pluginHost.hooks.registeredActions.map((name) => (
                <code key={name} className="admin-hook-chip admin-hook-chip--action">{name}</code>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Registry Browser ─────────────────────────────────── */}
      <section className="panel-card">
        <h3 className="panel-card-title">Community Plugin Registry</h3>
        <p className="panel-card-subtitle hint">
          Browse community plugins from{" "}
          <code>duksh/ficecal-plugin-registry</code>.
          Install readiness is validated before display.
        </p>

        {/* Controls */}
        <div className="admin-registry-controls">
          <input
            className="admin-registry-search"
            type="text"
            placeholder="Search plugins…"
            value={registrySearch}
            onChange={(e) => setRegistrySearch(e.target.value)}
            aria-label="Search registry plugins"
          />
          {registryTags.length > 0 && (
            <select
              className="admin-registry-tag-select"
              value={registryTagFilter}
              onChange={(e) => setRegistryTagFilter(e.target.value)}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {registryTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
          <button
            className="admin-registry-load-btn"
            onClick={registryLoaded ? applyRegistryFilters : loadRegistry}
            disabled={registryLoading}
            type="button"
          >
            {registryLoading
              ? "Loading…"
              : registryLoaded
                ? "Apply filters"
                : "Load registry"}
          </button>
          {registryLoaded && (
            <button
              className="admin-registry-refresh-btn"
              onClick={loadRegistry}
              disabled={registryLoading}
              type="button"
              title="Force refresh from GitHub"
            >
              ↻ Refresh
            </button>
          )}
        </div>

        {/* P7: Category filter buttons */}
        <div className="admin-registry-categories" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {REGISTRY_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`admin-hook-chip ${registryCategoryFilter === cat ? "admin-hook-chip--active" : ""}`}
              style={{
                fontWeight: registryCategoryFilter === cat ? 700 : 400,
                background: registryCategoryFilter === cat ? "var(--fc-accent, #3b82f6)" : undefined,
                color: registryCategoryFilter === cat ? "#fff" : undefined,
                borderColor: registryCategoryFilter === cat ? "var(--fc-accent, #3b82f6)" : undefined,
              }}
              onClick={() => setRegistryCategoryFilter(cat)}
              aria-pressed={registryCategoryFilter === cat}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Error */}
        {registryError && (
          <div className="admin-registry-error" role="alert">
            <strong>Registry error:</strong> {registryError}
            <p className="admin-registry-error-hint">
              The registry requires network access to{" "}
              <code>raw.githubusercontent.com</code>.
              This is a preview feature — live installs arrive in Phase 9.
            </p>
          </div>
        )}

        {/* Not yet loaded */}
        {!registryLoaded && !registryError && !registryLoading && (
          <div className="admin-registry-empty">
            <p>Click <strong>Load registry</strong> to browse community plugins.</p>
            <p className="hint">
              Fetches from{" "}
              <code>duksh/ficecal-plugin-registry</code> via GitHub raw.
              SHA-256 bundle verification available before install.
            </p>
          </div>
        )}

        {/* Plugin list */}
        {registryLoaded && !registryError && (
          <>
            {(() => {
              // P7: Apply category filter on top of the existing tag/search filter
              const filteredPlugins = registryCategoryFilter === "All"
                ? registryPlugins
                : registryPlugins.filter((p) => matchesCategory(p, registryCategoryFilter));
              return (
                <>
                  <p className="admin-registry-count hint">
                    {filteredPlugins.length} plugin{filteredPlugins.length !== 1 ? "s" : ""} found
                    {registrySearch && ` matching "${registrySearch}"`}
                    {registryTagFilter && ` tagged "${registryTagFilter}"`}
                    {registryCategoryFilter !== "All" && ` in category "${registryCategoryFilter}"`}
                  </p>

                  {filteredPlugins.length === 0 ? (
                    <p className="hint">No plugins match the current filters.</p>
                  ) : (
                    <ul className="admin-registry-list">
                      {filteredPlugins.map((plugin) => {
                        const readiness = registryReadiness.get(plugin.id);
                        const isReady = readiness?.ready ?? false;
                        const isExpanded = expandedPluginIds.has(plugin.id);
                        return (
                          <li key={plugin.id} className="admin-registry-item">
                            <div className="admin-registry-item-header">
                              <div className="admin-registry-item-title-row">
                                <span className="admin-registry-item-name">{plugin.name}</span>
                                <span className="admin-registry-item-version">v{plugin.version}</span>
                                <span className={`admin-ready-dot admin-ready-dot--${isReady ? "ready" : "pending"}`}
                                  title={isReady ? "Install-ready" : (readiness?.issues.join("; ") ?? "Not ready")}
                                />
                                {/* P7: Verified badge for registry plugins */}
                                <span
                                  className="admin-badge admin-badge--ready"
                                  style={{ fontSize: "0.7rem" }}
                                  title="Registry manifest present"
                                >
                                  ✓ Verified
                                </span>
                                {/* P7: Install readiness indicator */}
                                {isReady ? (
                                  <span style={{ fontSize: "0.72rem", color: "var(--fc-ok)", fontWeight: 600 }}>
                                    ● Ready to install
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.72rem", color: "var(--fc-warn)", fontWeight: 600 }}>
                                    ● Not ready
                                  </span>
                                )}
                                {/* U6: Update availability badge */}
                                {(() => {
                                  const installedEntry = pluginEntries.find((e) => e.plugin.id === plugin.id);
                                  if (!installedEntry) {
                                    return (
                                      <span style={{ fontSize: "0.7rem", color: "var(--fc-text-muted)" }}>
                                        Not installed
                                      </span>
                                    );
                                  }
                                  return compareVersions(plugin.version, installedEntry.plugin.version) > 0 ? (
                                    <span style={{ fontSize: "0.7rem", color: "var(--fc-accent, #1d4ed8)", fontWeight: 600 }}>
                                      ↑ Update v{plugin.version}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: "0.7rem", color: "var(--fc-ok)", fontWeight: 600 }}>
                                      ✓ Up to date
                                    </span>
                                  );
                                })()}
                              </div>
                              <code className="admin-registry-item-id">{plugin.id}</code>
                            </div>

                            <div className="admin-registry-item-meta">
                              <span className="admin-registry-meta-author">by {plugin.author}</span>
                              <span className="admin-registry-meta-sep">·</span>
                              <span className="admin-registry-meta-license">{plugin.license}</span>
                              {plugin.minFicecalVersion && (
                                <>
                                  <span className="admin-registry-meta-sep">·</span>
                                  <span className="admin-registry-meta-requires">
                                    requires FiceCal {plugin.minFicecalVersion}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Tags as colored pills */}
                            {plugin.tags && plugin.tags.length > 0 && (
                              <div className="admin-registry-tags">
                                {plugin.tags.map((tag) => (
                                  <button
                                    key={tag}
                                    className="admin-hook-chip"
                                    type="button"
                                    onClick={() => { setRegistryTagFilter(tag); }}
                                    title={`Filter by tag: ${tag}`}
                                    style={{
                                      background: tag.toLowerCase() === "billing"
                                        ? "var(--fc-accent-muted, #dbeafe)"
                                        : tag.toLowerCase() === "theme"
                                        ? "var(--fc-purple-muted, #ede9fe)"
                                        : tag.toLowerCase() === "economics"
                                        ? "var(--fc-ok-muted, #dcfce7)"
                                        : tag.toLowerCase() === "integration"
                                        ? "var(--fc-warn-muted, #fef9c3)"
                                        : undefined,
                                    }}
                                  >
                                    {tag}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Readiness issues */}
                            {!isReady && readiness && readiness.issues.length > 0 && (
                              <div className="admin-registry-issues">
                                {readiness.issues.map((issue, i) => (
                                  <p key={i} className="admin-registry-issue">⚠ {issue}</p>
                                ))}
                              </div>
                            )}

                            {/* P7: View Details expansion */}
                            <div className="admin-registry-actions">
                              {plugin.homepageUrl && (
                                <a
                                  className="admin-registry-link"
                                  href={plugin.homepageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Homepage ↗
                                </a>
                              )}
                              <span className="admin-registry-published hint">
                                Published {new Date(plugin.publishedAt).toLocaleDateString()}
                              </span>
                              <button
                                type="button"
                                className="admin-registry-link"
                                onClick={() => togglePluginExpand(plugin.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              >
                                {isExpanded ? "▲ Hide Details" : "▼ View Details"}
                              </button>
                            </div>

                            {/* P7: Expanded details */}
                            {isExpanded && (
                              <div
                                className="admin-registry-details"
                                style={{
                                  marginTop: "0.5rem",
                                  padding: "0.6rem 0.75rem",
                                  background: "var(--fc-surface, #f8fafc)",
                                  border: "1px solid var(--fc-border)",
                                  borderRadius: "0.375rem",
                                  fontSize: "0.82rem",
                                }}
                              >
                                <p style={{ margin: "0 0 0.4rem" }}>{plugin.description}</p>
                                {plugin.minFicecalVersion && (
                                  <p style={{ margin: "0 0 0.2rem", color: "var(--fc-text-muted)" }}>
                                    Requires FiceCal {plugin.minFicecalVersion}+
                                  </p>
                                )}
                                {plugin.bundleSha256 && (
                                  <p style={{ margin: "0", color: "var(--fc-text-muted)", fontSize: "0.72rem", wordBreak: "break-all" }}>
                                    SHA-256: <code>{plugin.bundleSha256}</code>
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              );
            })()}
          </>
        )}
      </section>

      {/* ── 5. Security ─────────────────────────────────────────────────── */}
      <section className="panel" aria-label="Security">
        <h2>Security</h2>
        <p className="hint admin-section-desc">
          Plugin verification status, sandbox configuration, and active feature flag security implications.
        </p>

        {/* Plugin Verification Status */}
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>Plugin Verification Status</h3>
        {pluginEntries.length === 0 ? (
          <p className="hint" style={{ color: "var(--fc-text-muted)" }}>No plugins registered.</p>
        ) : (
          <>
            {/* Unverified community plugin warning */}
            {(() => {
              const unverifiedCount = pluginEntries.filter(
                (e) => !isCorePlugin(e.plugin) && e.plugin.manifest === undefined
              ).length;
              if (unverifiedCount === 0) return null;
              return (
                <div
                  role="alert"
                  style={{
                    marginBottom: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    background: "var(--fc-warn-bg, #fefce8)",
                    border: "1px solid var(--fc-warn, #f59e0b)",
                    borderRadius: "0.375rem",
                    fontSize: "0.85rem",
                  }}
                >
                  ⚠️ {unverifiedCount} unverified plugin{unverifiedCount !== 1 ? "s" : ""} detected.
                  Community plugins without a manifest cannot be audited for malicious contributions.
                </div>
              );
            })()}

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--fc-border)", textAlign: "left" }}>
                  <th style={{ padding: "0.3rem 0.5rem" }}>Plugin ID</th>
                  <th style={{ padding: "0.3rem 0.5rem" }}>Name</th>
                  <th style={{ padding: "0.3rem 0.5rem" }}>Version</th>
                  <th style={{ padding: "0.3rem 0.5rem" }}>Type</th>
                  <th style={{ padding: "0.3rem 0.5rem" }}>Verified</th>
                </tr>
              </thead>
              <tbody>
                {pluginEntries.map((entry) => {
                  const status = pluginVerificationStatus(entry.plugin);
                  return (
                    <tr
                      key={entry.plugin.id}
                      style={{ borderBottom: "1px solid var(--fc-border)" }}
                    >
                      <td style={{ padding: "0.3rem 0.5rem" }}>
                        <code style={{ fontSize: "0.75rem" }}>{entry.plugin.id}</code>
                      </td>
                      <td style={{ padding: "0.3rem 0.5rem" }}>{entry.plugin.name}</td>
                      <td style={{ padding: "0.3rem 0.5rem" }}>v{entry.plugin.version}</td>
                      <td style={{ padding: "0.3rem 0.5rem" }}>
                        {isCorePlugin(entry.plugin) ? (
                          <span className="admin-badge admin-badge--core" style={{ fontSize: "0.7rem" }}>Core</span>
                        ) : (
                          <span className="admin-badge" style={{ fontSize: "0.7rem" }}>Community</span>
                        )}
                      </td>
                      <td style={{ padding: "0.3rem 0.5rem" }}>
                        {status === "core" && (
                          <span style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>—</span>
                        )}
                        {status === "verified" && (
                          <span
                            className="admin-badge admin-badge--ready"
                            title="Verified: manifest present and validated"
                            style={{ fontSize: "0.7rem" }}
                          >
                            ✓ Verified
                          </span>
                        )}
                        {status === "unverified" && (
                          <span
                            className="admin-badge"
                            title="Unverified: no manifest — contributions cannot be audited"
                            style={{
                              fontSize: "0.7rem",
                              background: "var(--fc-warn-bg, #fefce8)",
                              color: "var(--fc-warn, #92400e)",
                              border: "1px solid var(--fc-warn, #f59e0b)",
                            }}
                          >
                            ⚠ Unverified
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* U4: Hard-disabled plugins */}
        {(() => {
          const hardDisabledEntries = pluginEntries.filter(
            (e) => typeof pluginHost.isHardDisabled === "function" && pluginHost.isHardDisabled(e.plugin.id)
          );
          if (hardDisabledEntries.length === 0) return null;
          return (
            <>
              <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem" }}>Hard-Disabled Plugins</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {hardDisabledEntries.map((e) => (
                  <li key={e.plugin.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                    <span style={{ color: "var(--fc-crit, #ef4444)", fontWeight: 600 }}>🚫</span>
                    <code style={{ fontSize: "0.75rem" }}>{e.plugin.id}</code>
                    <span style={{ color: "var(--fc-text-muted)" }}>— contributions removed from all registries</span>
                  </li>
                ))}
              </ul>
            </>
          );
        })()}

        {/* Sandbox Status */}
        <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem" }}>Sandbox Status</h3>
        <div className="admin-hooks-status">
          {pluginHost.sandbox !== null ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <span className="admin-ready-dot admin-ready-dot--ready" title="Sandbox active" />
              <span><strong>PluginSandbox active</strong> — community plugin execution is sandboxed.</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <span className="admin-ready-dot admin-ready-dot--pending" title="No sandbox" />
              <span>No sandbox configured — plugin execution runs without timeout protection.</span>
            </div>
          )}
        </div>

        {/* Feature Flag Security */}
        <h3 style={{ fontSize: "0.95rem", margin: "1rem 0 0.5rem" }}>Feature Flag Security</h3>
        {featureFlags.length === 0 ? (
          <p className="hint" style={{ color: "var(--fc-text-muted)" }}>No feature flags declared.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {featureFlags.map((flag) => (
              <li key={flag.key} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.82rem" }}>
                <span
                  className={`admin-status-dot ${flag.active ? "admin-status-dot--on" : "admin-status-dot--off"}`}
                  title={flag.active ? "Active" : "Inactive"}
                  style={{ marginTop: "0.25rem", flexShrink: 0 }}
                />
                <div>
                  <span style={{ fontWeight: 600 }}>{flag.displayName}</span>
                  {flag.phase && (
                    <span className="admin-phase-tag" style={{ marginLeft: "0.4rem", fontSize: "0.7rem" }}>{flag.phase}</span>
                  )}
                  {flag.description && (
                    <p style={{ margin: "0.1rem 0 0", color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>
                      {flag.description}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
