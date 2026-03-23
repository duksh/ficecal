import type { ThemePreference, ResolvedTheme } from "./types.js";
import type { StorageAdapter } from "./preferences.js";
import { MemoryStorageAdapter } from "./preferences.js";

// ─── Plugin theme source (bridge to ThemeRegistry) ────────────────────────────

/**
 * Minimal interface for a registry of plugin-contributed themes.
 *
 * Structurally compatible with ThemeRegistry from @ficecal/plugin-api —
 * no hard import dependency needed, keeping ui-foundation zero-dependency.
 *
 * Pass `pluginHost.themes` directly — TypeScript's structural typing ensures
 * the ThemeRegistry class satisfies this interface without any cast.
 */
export interface ThemeTokenSource {
  /** Look up a theme's CSS token map by id. */
  get(id: string): { tokens: Record<string, string> } | undefined;
  /** Enumerate all registered themes for theme picker rendering. */
  list(): ReadonlyArray<{
    id: string;
    displayName: string;
    previewSwatch?: string;
    description?: string;
  }>;
}

// ─── System-preference adapter ────────────────────────────────────────────────

/**
 * Minimal interface for detecting and observing the OS color scheme preference.
 * Allows injection of a real `window.matchMedia` or a test fake.
 */
export interface SystemThemeAdapter {
  /** Returns true when the OS is in dark mode. */
  prefersDark(): boolean;
  /** Subscribe to OS theme changes. Returns an unsubscribe function. */
  onChange(handler: (prefersDark: boolean) => void): () => void;
}

/** No-op adapter for test and SSR environments. Always reports light. */
export class StaticSystemThemeAdapter implements SystemThemeAdapter {
  constructor(private readonly dark: boolean = false) {}
  prefersDark(): boolean { return this.dark; }
  onChange(_handler: (prefersDark: boolean) => void): () => void { return () => undefined; }
}

/** Live adapter that wraps `window.matchMedia`. */
export class MediaQuerySystemThemeAdapter implements SystemThemeAdapter {
  private readonly mq: MediaQueryList;
  constructor() {
    this.mq = window.matchMedia("(prefers-color-scheme: dark)");
  }
  prefersDark(): boolean { return this.mq.matches; }
  onChange(handler: (prefersDark: boolean) => void): () => void {
    const listener = (e: MediaQueryListEvent) => handler(e.matches);
    this.mq.addEventListener("change", listener);
    return () => this.mq.removeEventListener("change", listener);
  }
}

// ─── CSS token definitions ─────────────────────────────────────────────────────

/**
 * Design-token sets for each resolved theme.
 * Applied as CSS custom properties on `<html data-theme="light|dark">`.
 *
 * Tokens follow the `--fc-*` namespace to avoid collisions.
 */
export const THEME_TOKENS: Record<ResolvedTheme, Record<string, string>> = {
  light: {
    "--fc-bg-base":        "#ffffff",
    "--fc-bg-surface":     "#f8fafc",
    "--fc-bg-elevated":    "#f1f5f9",
    "--fc-border":         "#e2e8f0",
    "--fc-text-primary":   "#0f172a",
    "--fc-text-secondary": "#475569",
    "--fc-text-tertiary":  "#94a3b8",
    "--fc-accent":         "#6366f1",
    "--fc-accent-hover":   "#4f46e5",
    "--fc-success":        "#10b981",
    "--fc-warning":        "#f59e0b",
    "--fc-danger":         "#ef4444",
  },
  dark: {
    "--fc-bg-base":        "#0a0a0f",
    "--fc-bg-surface":     "#111118",
    "--fc-bg-elevated":    "#1a1a24",
    "--fc-border":         "#2a2a3a",
    "--fc-text-primary":   "#f1f5f9",
    "--fc-text-secondary": "#94a3b8",
    "--fc-text-tertiary":  "#475569",
    "--fc-accent":         "#818cf8",
    "--fc-accent-hover":   "#a5b4fc",
    "--fc-success":        "#34d399",
    "--fc-warning":        "#fbbf24",
    "--fc-danger":         "#f87171",
  },
};

// ─── Document adapter ─────────────────────────────────────────────────────────

/**
 * Minimal interface for applying theme tokens to a document root.
 * Allows injection of real `document.documentElement` or a test fake.
 */
export interface DocumentThemeAdapter {
  setAttribute(name: string, value: string): void;
  setStyle(property: string, value: string): void;
}

/** No-op document adapter — records calls without touching a DOM. */
export class RecordingDocumentAdapter implements DocumentThemeAdapter {
  readonly attributes = new Map<string, string>();
  readonly styles = new Map<string, string>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  setStyle(property: string, value: string): void {
    this.styles.set(property, value);
  }
}

// ─── ThemeManager ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "ficecal:theme:v1";
const CUSTOM_THEME_KEY = "ficecal:theme:custom:v1";

/**
 * Manages the active color theme for FiceCal v2.
 *
 * Responsibilities:
 * - Persist the user's ThemePreference ('light' | 'dark' | 'system')
 * - Resolve the effective ResolvedTheme by querying the OS when pref = 'system'
 * - Apply CSS design tokens to the document root
 * - Subscribe to OS theme changes and re-apply automatically when pref = 'system'
 * - Notify subscribers of resolved theme changes (for React/UI sync)
 *
 * No-FWOT (Flash of Wrong Theme) contract: callers should invoke apply() as
 * early as possible in the document lifecycle (before first paint). The
 * ThemeManager is synchronous by design — no async gaps.
 */
export class ThemeManager {
  private preference: ThemePreference;
  private customThemeId: string | null;
  private readonly listeners = new Set<(resolved: ResolvedTheme) => void>();
  private unsubscribeSystem: (() => void) | null = null;

  /**
   * @param storage   - Persistence adapter (localStorage in browser, MemoryStorageAdapter in tests)
   * @param system    - OS dark-mode adapter (MediaQuerySystemThemeAdapter in browser)
   * @param doc       - DOM adapter for applying tokens (documentElement wrapper in browser)
   * @param themeSource - Optional plugin theme registry. When provided, plugin-contributed themes
   *   are available for selection via setCustomTheme(). Pass pluginHost.themes directly —
   *   ThemeRegistry is structurally compatible with ThemeTokenSource.
   */
  constructor(
    private readonly storage: StorageAdapter = new MemoryStorageAdapter(),
    private readonly system: SystemThemeAdapter = new StaticSystemThemeAdapter(),
    private readonly doc: DocumentThemeAdapter = new RecordingDocumentAdapter(),
    private readonly themeSource?: ThemeTokenSource,
  ) {
    this.preference = this.loadPreference();
    this.customThemeId = this.loadCustomThemeId();
    this.apply();
    this.watchSystem();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Current user preference (may be 'system'). */
  getPreference(): ThemePreference {
    return this.preference;
  }

  /** Currently resolved theme (always 'light' or 'dark'). */
  getResolved(): ResolvedTheme {
    return this.resolve(this.preference);
  }

  /**
   * The currently active theme id.
   *
   * - When a custom plugin theme is selected, returns its id (e.g. "high-contrast").
   * - Otherwise returns the resolved system/user preference ("light" or "dark").
   */
  getActiveThemeId(): string {
    return this.customThemeId ?? this.getResolved();
  }

  /** Update the preference, persist, apply, and notify subscribers. */
  setPreference(pref: ThemePreference): void {
    this.preference = pref;
    this.storage.setItem(STORAGE_KEY, pref);
    this.apply();
    this.watchSystem(); // re-wire system listener if needed
    this.notify();
  }

  /**
   * Activate a plugin-contributed theme by id.
   *
   * The id must be registered in the ThemeTokenSource passed to the constructor.
   * Overrides the light/dark/system preference until clearCustomTheme() is called.
   * Persists across sessions.
   */
  setCustomTheme(id: string): void {
    this.customThemeId = id;
    this.storage.setItem(CUSTOM_THEME_KEY, id);
    this.apply();
    this.notify();
  }

  /**
   * Clear any active custom theme, restoring light/dark/system preference behavior.
   */
  clearCustomTheme(): void {
    this.customThemeId = null;
    this.storage.removeItem(CUSTOM_THEME_KEY);
    this.apply();
    this.notify();
  }

  /**
   * Return all themes available for the theme picker.
   * Sourced from the ThemeTokenSource (ThemeRegistry) if provided.
   * Returns an empty array when no themeSource was given.
   */
  listThemes(): ReadonlyArray<{
    id: string;
    displayName: string;
    previewSwatch?: string;
    description?: string;
  }> {
    return this.themeSource?.list() ?? [];
  }

  /** Cycle through light → dark → system → light. */
  toggle(): void {
    const next: Record<ThemePreference, ThemePreference> = {
      light: "dark",
      dark:  "system",
      system: "light",
    };
    this.setPreference(next[this.preference]);
  }

  subscribe(listener: (resolved: ResolvedTheme) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Apply current theme tokens to the document. Call early to avoid FWOT.
   *
   * Resolution order:
   *   1. Custom plugin theme (if set and found in themeSource) — uses registry tokens
   *   2. Light/dark from user preference + system detection — uses THEME_TOKENS
   */
  apply(): void {
    // 1. Plugin-contributed custom theme (e.g. high-contrast, ocean-blue)
    if (this.customThemeId && this.themeSource) {
      const theme = this.themeSource.get(this.customThemeId);
      if (theme) {
        this.doc.setAttribute("data-theme", this.customThemeId);
        for (const [prop, value] of Object.entries(theme.tokens)) {
          this.doc.setStyle(prop, value);
        }
        return;
      }
    }

    // 2. Resolved light/dark from preference + OS detection
    const resolved = this.getResolved();
    this.doc.setAttribute("data-theme", resolved);
    const tokens = THEME_TOKENS[resolved];
    for (const [prop, value] of Object.entries(tokens)) {
      this.doc.setStyle(prop, value);
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private resolve(pref: ThemePreference): ResolvedTheme {
    if (pref === "system") return this.system.prefersDark() ? "dark" : "light";
    return pref;
  }

  private loadPreference(): ThemePreference {
    const stored = this.storage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  }

  private loadCustomThemeId(): string | null {
    return this.storage.getItem(CUSTOM_THEME_KEY);
  }

  private watchSystem(): void {
    // Remove previous listener if any
    if (this.unsubscribeSystem) {
      this.unsubscribeSystem();
      this.unsubscribeSystem = null;
    }
    if (this.preference === "system") {
      this.unsubscribeSystem = this.system.onChange(() => {
        this.apply();
        this.notify();
      });
    }
  }

  private notify(): void {
    const resolved = this.getResolved();
    this.listeners.forEach((l) => l(resolved));
  }
}
