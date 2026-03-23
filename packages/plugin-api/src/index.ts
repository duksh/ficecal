// ─── FiceCal Plugin API ────────────────────────────────────────────────────────

// ─── Types ──────────────────────────────────────────────────────────────────────
export type {
  ThemeContribution,
  BillingLineItem,
  BillingPeriodSummary,
  BillingFixtureContribution,
  BillingAdapterContribution,
  UiPanelContribution,
  EconomicsEngineContribution,
  PluginMcpTool,
  FicecalPluginContributions,
  FicecalPlugin,
  PluginErrorCode,
  FeatureFlagDescriptor,
  PluginEntry,
} from "./types.js";
export { PluginRegistrationError } from "./types.js";

// ─── ThemeRegistry ─────────────────────────────────────────────────────────────
export type { ThemeDocumentAdapter } from "./theme-registry.js";
export { ThemeRegistry, RecordingThemeAdapter } from "./theme-registry.js";

// ─── BillingRegistry ───────────────────────────────────────────────────────────
export { BillingRegistry } from "./billing-registry.js";

// ─── HookRegistry ──────────────────────────────────────────────────────────────
export type { FilterCallback, ActionCallback } from "./hook-registry.js";
export { HookRegistry } from "./hook-registry.js";

// ─── PluginHost ────────────────────────────────────────────────────────────────
export type { McpToolRegistrar } from "./plugin-host.js";
export { PluginHost } from "./plugin-host.js";

// ─── WorkspaceRegistry ─────────────────────────────────────────────────────────
export { WorkspaceRegistry } from "./workspace-registry.js";

// ─── PluginSandbox (Phase 10B P5) ──────────────────────────────────────────────
export type { SandboxOptions, SandboxCallContext } from "./sandbox.js";
export { PluginSandbox, SandboxViolationError } from "./sandbox.js";

// ─── Plugin Manifests (Phase 10B P6) ───────────────────────────────────────────
export type { FicecalPluginManifest, PluginLockEntry, PluginLockFile } from "./manifest.js";
export { ManifestValidationError, validatePluginManifest, verifyBundleHash, createLockFile, upsertLockEntry, removeLockEntry } from "./manifest.js";

// ─── Auto-update checker (Phase 10B P7) ────────────────────────────────────────
export type { InstalledPlugin, PluginUpdate } from "./updater.js";
export { PluginUpdateChecker } from "./updater.js";
