// ─── ThemePicker ──────────────────────────────────────────────────────────────
//
// Phase 7: Full theme picker that shows all plugin-contributed themes.
// Replaces the simple ThemeToggle (light → dark → system cycle) with a
// popover panel listing every theme registered in the ThemeRegistry.
//
// Architecture:
//   ThemeManager.listThemes() → sourced from pluginHost.themes (ThemeRegistry)
//   ThemeManager.setCustomTheme(id) → applies a plugin-contributed theme
//   ThemeManager.clearCustomTheme() → restores light/dark/system pref
//
// Built-in themes shipped:
//   light, dark, high-contrast (WCAG AAA), ocean-blue

import { useState, useEffect, useRef } from "react";
import type { ThemeManager } from "@ficecal/ui-foundation";

interface Props {
  theme: ThemeManager;
}

// ─── Labels + icons for the base system preferences ──────────────────────────

const SYSTEM_PREF_LABELS: Record<string, { icon: string; label: string }> = {
  light: { icon: "☀️", label: "Light" },
  dark:  { icon: "🌙", label: "Dark" },
};

// ─── ThemePicker ──────────────────────────────────────────────────────────────

export function ThemePicker({ theme }: Props) {
  const [activeId, setActiveId] = useState(theme.getActiveThemeId());
  const [open, setOpen] = useState(false);
  const [themes, setThemes] = useState(theme.listThemes());
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Re-sync when theme changes (could be changed by other means, e.g. toggle())
  useEffect(() => {
    return theme.subscribe(() => {
      setActiveId(theme.getActiveThemeId());
      setThemes(theme.listThemes()); // registry may have grown at runtime
      theme.apply();
    });
  }, [theme]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const activeTheme = themes.find((t) => t.id === activeId);
  const triggerSwatch = activeTheme?.previewSwatch;
  const triggerLabel = activeTheme?.displayName ?? activeId;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function selectTheme(id: string) {
    theme.setCustomTheme(id);
    setActiveId(id);
    setOpen(false);
  }

  function useSystemPref(pref: "light" | "dark") {
    theme.clearCustomTheme();
    theme.setPreference(pref);
    setActiveId(theme.getActiveThemeId());
    setOpen(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="theme-picker" style={{ position: "relative" }}>
      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        className="theme-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${triggerLabel}`}
        title={`Active theme: ${triggerLabel}`}
      >
        {triggerSwatch && (
          <span
            className="theme-picker-swatch"
            style={{ background: triggerSwatch }}
            aria-hidden="true"
          />
        )}
        <span className="theme-picker-trigger-label">{triggerLabel}</span>
        <span className="theme-picker-chevron" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* ── Popover panel ───────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          className="theme-picker-panel"
          role="listbox"
          aria-label="Available themes"
        >
          {/* Plugin-contributed + built-in named themes */}
          <div className="theme-picker-section">
            <p className="theme-picker-section-label">Themes</p>
            <ul className="theme-picker-list" role="list">
              {themes.map((t) => (
                <li key={t.id} role="option" aria-selected={t.id === activeId}>
                  <button
                    className={`theme-picker-item${t.id === activeId ? " is-active" : ""}`}
                    onClick={() => selectTheme(t.id)}
                    title={t.description}
                  >
                    {t.previewSwatch && (
                      <span
                        className="theme-picker-swatch"
                        style={{ background: t.previewSwatch }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="theme-picker-item-name">{t.displayName}</span>
                    {t.description && (
                      <span className="theme-picker-item-desc">{t.description}</span>
                    )}
                    {t.id === activeId && (
                      <span className="theme-picker-check" aria-label="active">✓</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* System / explicit light+dark preferences (no custom override) */}
          <div className="theme-picker-section theme-picker-section--system">
            <p className="theme-picker-section-label">System preference</p>
            <div className="theme-picker-pref-row">
              {(["light", "dark"] as const).map((pref) => {
                const { icon, label } = SYSTEM_PREF_LABELS[pref];
                return (
                  <button
                    key={pref}
                    className="theme-picker-pref-btn"
                    onClick={() => useSystemPref(pref)}
                    title={`Switch to ${label} theme`}
                  >
                    <span aria-hidden="true">{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
