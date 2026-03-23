// ─── useUiFoundation ──────────────────────────────────────────────────────────
//
// Bootstraps all @ficecal/ui-foundation singletons for the browser runtime.
// Phase 7: wires the PluginHost so plugin-contributed themes are available
// through ThemeManager.listThemes() and ThemeManager.setCustomTheme().
//
// Returns stable references — safe to call from multiple components.

import { useMemo } from "react";
import {
  PreferenceStore,
  ThemeManager,
  IntentScopeState,
  LocalizationShell,
  MediaQuerySystemThemeAdapter,
  DEFAULT_PREFERENCES,
  BUILT_IN_THEMES,
} from "@ficecal/ui-foundation";
import { PluginHost } from "@ficecal/plugin-api";
import type { FicecalPlugin } from "@ficecal/plugin-api";

// ─── Browser-compatible storage adapter ───────────────────────────────────────

const localStorageAdapter = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

// ─── Built-in themes plugin manifest ─────────────────────────────────────────
//
// Light, dark, high-contrast, and ocean-blue themes are themselves FiceCal
// plugins. No special-casing in core — the plugin system is the mechanism.
// BUILT_IN_THEMES (from ui-foundation) is structurally compatible with
// ThemeContribution (from plugin-api): same required fields, same token shape.

const builtInThemesPlugin: FicecalPlugin = {
  id: "@ficecal/built-in-themes",
  name: "FiceCal Built-in Themes",
  version: "0.7.0",
  description:
    "Core theme palette: light, dark, high-contrast (WCAG AAA), and ocean-blue.",
  contributions: {
    // Structural assignment — both ThemeContribution definitions share the same shape.
    themes: BUILT_IN_THEMES as unknown as FicecalPlugin["contributions"]["themes"],
  },
};

// ─── No-op MCP registrar for the browser runtime ─────────────────────────────
//
// The web app doesn't manage MCP tools directly (the services/mcp server does).
// PluginHost requires an McpToolRegistrar; this satisfies the interface.

const browserMcpRegistrar = { register: (_tool: unknown) => {} };

// ─── Singletons (module-level, one instance per app lifetime) ─────────────────

let _pluginHost: PluginHost | null = null;
let _preferenceStore: PreferenceStore | null = null;
let _themeManager: ThemeManager | null = null;
let _intentScopeState: IntentScopeState | null = null;
let _localizationShell: LocalizationShell | null = null;

// ─── Known feature flags ──────────────────────────────────────────────────────
//
// Declare all flags here so the admin panel's Feature Control Panel can list
// them even before they are activated.  The constructor activeFeatureFlags list
// controls which flags START as active; individual flags can be toggled at
// runtime via the admin panel (enableFeatureFlag / disableFeatureFlag).

const KNOWN_FEATURE_FLAGS = [
  {
    key: "commitment-management",
    displayName: "Commitment Management",
    description:
      "Enable Reserved Instance / Savings Plan commitment tracking panels " +
      "and the commitment-management MCP tool suite.",
    phase: "Phase 1",
  },
  {
    key: "shared-cost-allocation",
    displayName: "Shared Cost Allocation",
    description:
      "Distribute shared infrastructure costs across workspaces using " +
      "configurable allocation strategies (even split, proportional, weighted).",
    phase: "Phase 1",
  },
  {
    key: "live-billing",
    displayName: "Live Billing Ingestion",
    description:
      "Enable real-time billing adapter calls to provider APIs (AWS Cost Explorer, " +
      "GCP Billing, Azure Cost Management). Requires provider credentials configured " +
      "in the MCP service layer.",
    phase: "Phase 7",
  },
  {
    key: "workspace-scoping",
    displayName: "Workspace-scoped Plugins",
    description:
      "Scope plugin contributions (themes, billing adapters, MCP tools) per " +
      "workspace via WorkspaceRegistry. Required for multi-tenant deployments.",
    phase: "Phase 7",
  },
] as const;

function getPluginHost(): PluginHost {
  if (!_pluginHost) {
    _pluginHost = new PluginHost(browserMcpRegistrar);

    // Register built-in themes
    _pluginHost.register(builtInThemesPlugin);

    // Declare all known feature flags for the admin panel
    for (const descriptor of KNOWN_FEATURE_FLAGS) {
      _pluginHost.declareFeatureFlag(descriptor);
    }
  }
  return _pluginHost;
}

function getPreferenceStore(): PreferenceStore {
  if (!_preferenceStore) {
    _preferenceStore = new PreferenceStore(localStorageAdapter);
  }
  return _preferenceStore;
}

function getThemeManager(): ThemeManager {
  if (!_themeManager) {
    // Phase 7: pass pluginHost.themes as the theme source so ThemeManager
    // can look up tokens for plugin-contributed themes (high-contrast, ocean-blue, …)
    // and expose them via listThemes() for the ThemePicker UI.
    const host = getPluginHost();
    _themeManager = new ThemeManager(
      localStorageAdapter,
      new MediaQuerySystemThemeAdapter(),
      {
        setAttribute: (name: string, value: string) =>
          document.documentElement.setAttribute(name, value),
        setStyle: (property: string, value: string) =>
          document.documentElement.style.setProperty(property, value),
      },
      host.themes, // ThemeTokenSource — structurally compatible with ThemeRegistry
    );
    _themeManager.apply(); // synchronous — no FWOT
  }
  return _themeManager;
}

function getIntentScopeState(): IntentScopeState {
  if (!_intentScopeState) {
    const prefs = getPreferenceStore().get();
    _intentScopeState = new IntentScopeState({
      intent: prefs.intent,
      scope: prefs.scope,
      mode: prefs.mode,
    });
  }
  return _intentScopeState;
}

function getLocalizationShell(): LocalizationShell {
  if (!_localizationShell) {
    const prefs = getPreferenceStore().get();
    _localizationShell = new LocalizationShell(prefs.locale);
  }
  return _localizationShell;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UiFoundation {
  preferences: PreferenceStore;
  theme: ThemeManager;
  intentScope: IntentScopeState;
  i18n: LocalizationShell;
  defaultPreferences: typeof DEFAULT_PREFERENCES;
  /** Plugin host — use to register community plugins at runtime. */
  pluginHost: PluginHost;
}

/**
 * Returns stable singleton references to all ui-foundation primitives.
 * Bootstrap this once at the root component and pass down via props or context.
 *
 * Phase 7: pluginHost is now included. ThemeManager is wired to pluginHost.themes
 * so theme.listThemes() returns all registered themes including plugin-contributed ones.
 */
export function useUiFoundation(): UiFoundation {
  return useMemo(
    () => ({
      preferences: getPreferenceStore(),
      theme: getThemeManager(),
      intentScope: getIntentScopeState(),
      i18n: getLocalizationShell(),
      defaultPreferences: DEFAULT_PREFERENCES,
      pluginHost: getPluginHost(),
    }),
    []
  );
}
