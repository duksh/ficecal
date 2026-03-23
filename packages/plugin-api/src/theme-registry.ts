// ─── ThemeRegistry ─────────────────────────────────────────────────────────────
//
// Manages plugin-contributed visual themes.
// Decoupled from DOM — callers supply a DocumentThemeAdapter.

import type { ThemeContribution } from "./types.js";
import { PluginRegistrationError } from "./types.js";

/** Minimal DOM adapter for applying theme tokens. */
export interface ThemeDocumentAdapter {
  setAttribute(name: string, value: string): void;
  setStyle(property: string, value: string): void;
}

/** No-op adapter for tests — records calls without touching a DOM. */
export class RecordingThemeAdapter implements ThemeDocumentAdapter {
  readonly attributes = new Map<string, string>();
  readonly styles = new Map<string, string>();
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  setStyle(property: string, value: string): void { this.styles.set(property, value); }
}

export class ThemeRegistry {
  private readonly themes = new Map<string, ThemeContribution>();
  /** Maps theme id → plugin id that contributed it. */
  private readonly themeOwners = new Map<string, string>();

  /** Register a theme contribution. Throws on duplicate id. */
  register(theme: ThemeContribution, pluginId = "unknown"): void {
    if (this.themes.has(theme.id)) {
      throw new PluginRegistrationError(
        "DUPLICATE_THEME",
        `Theme "${theme.id}" is already registered.`,
        pluginId,
      );
    }
    this.themes.set(theme.id, theme);
    this.themeOwners.set(theme.id, pluginId);
  }

  /**
   * Remove all themes contributed by the given plugin.
   * Returns the number of themes removed.
   */
  unregisterByPlugin(pluginId: string): number {
    let count = 0;
    for (const [themeId, owner] of this.themeOwners) {
      if (owner === pluginId) {
        this.themes.delete(themeId);
        this.themeOwners.delete(themeId);
        count++;
      }
    }
    return count;
  }

  /** Look up a theme by id. */
  get(id: string): ThemeContribution | undefined {
    return this.themes.get(id);
  }

  /** All registered themes in registration order. */
  list(): ThemeContribution[] {
    return [...this.themes.values()];
  }

  /** Total number of registered themes. */
  get size(): number {
    return this.themes.size;
  }

  /**
   * Apply a theme to the document.
   * Sets `data-theme="<id>"` and inlines all token CSS custom properties.
   */
  apply(id: string, doc: ThemeDocumentAdapter): void {
    const theme = this.themes.get(id);
    if (!theme) throw new Error(`Theme "${id}" is not registered.`);
    doc.setAttribute("data-theme", id);
    for (const [prop, value] of Object.entries(theme.tokens)) {
      doc.setStyle(prop, value);
    }
  }
}
