// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  Intent,
  Scope,
  Mode,
  ThemePreference,
  ResolvedTheme,
  Locale,
  BreakpointKey,
  UserPreferences,
} from "./types.js";
export {
  INTENT_LABELS,
  INTENT_DESCRIPTIONS,
  ALL_INTENTS,
  SCOPE_LABELS,
  SCOPE_DESCRIPTIONS,
  ALL_SCOPES,
  INTENT_SCOPE_AFFINITIES,
  MODE_LABELS,
  MODE_DESCRIPTIONS,
  ALL_MODES,
  ALL_THEME_PREFERENCES,
  ALL_LOCALES,
  LOCALE_LABELS,
  BREAKPOINTS,
  DEFAULT_PREFERENCES,
} from "./types.js";

// ─── Preferences ──────────────────────────────────────────────────────────────
export type { StorageAdapter } from "./preferences.js";
export { MemoryStorageAdapter, PreferenceStore } from "./preferences.js";

// ─── Theme ────────────────────────────────────────────────────────────────────
export type { SystemThemeAdapter, DocumentThemeAdapter, ThemeTokenSource } from "./theme.js";
export {
  StaticSystemThemeAdapter,
  MediaQuerySystemThemeAdapter,
  RecordingDocumentAdapter,
  ThemeManager,
  THEME_TOKENS,
} from "./theme.js";

// ─── Intent / Scope / Mode ────────────────────────────────────────────────────
export type { IntentScopeSnapshot } from "./intent-scope.js";
export {
  IntentScopeState,
  serializeState,
  deserializeState,
} from "./intent-scope.js";

// ─── Localization ─────────────────────────────────────────────────────────────
export { LocalizationShell } from "./i18n.js";

// ─── Keyboard ─────────────────────────────────────────────────────────────────
export type { KeyboardShortcut } from "./keyboard.js";
export {
  KeyboardShortcutRegistry,
  getFocusableElements,
  getFirstFocusable,
  getLastFocusable,
  contrastRatio,
  sRgbToLinear,
  relativeLuminance,
  WCAG_CONTRAST,
} from "./keyboard.js";

// ─── Built-in theme plugins (contribution point objects) ──────────────────────
export type { ThemeContribution } from "./theme-plugins.js";
export {
  lightThemeContribution,
  darkThemeContribution,
  highContrastThemeContribution,
  oceanBlueThemeContribution,
  BUILT_IN_THEMES,
} from "./theme-plugins.js";

// ─── Telemetry ────────────────────────────────────────────────────────────────
export type {
  TelemetryEvent,
  TelemetryHandler,
  TelemetryEmitter,
  IntentChangedEvent,
  ScopeChangedEvent,
  ModeChangedEvent,
  ThemeChangedEvent,
  LocaleChangedEvent,
  CalculationPerformedEvent,
  RecommendationViewedEvent,
  ScenarioLoadedEvent,
  EvidencePanelOpenedEvent,
  HealthScoreViewedEvent,
  PreferenceSavedEvent,
  ErrorBoundaryTriggeredEvent,
} from "./telemetry.js";
export {
  ConsoleTelemetryEmitter,
  BufferedTelemetryEmitter,
  generateSessionId,
  makeBaseEvent,
} from "./telemetry.js";
