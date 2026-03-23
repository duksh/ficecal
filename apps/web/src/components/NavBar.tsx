// ─── NavBar ───────────────────────────────────────────────────────────────────
//
// Sticky top navigation bar with section anchors, theme picker, and active
// section tracking via IntersectionObserver.
//
// Phase 7: ThemeToggle replaced by ThemePicker — shows all plugin-contributed
// themes (light, dark, high-contrast, ocean-blue, and any community plugins
// registered at runtime).

import { useState, useEffect } from "react";
import type { ThemeManager, LocalizationShell } from "@ficecal/ui-foundation";
import { ThemePicker } from "./ThemePicker.js";

interface NavSection {
  id: string;
  label: string;
}

const SECTIONS: NavSection[] = [
  { id: "calculator",   label: "Calculator" },
  { id: "commitments",  label: "Commitments" },
  { id: "health",       label: "Health" },
  { id: "carbon",       label: "Carbon" },
  { id: "architect",    label: "Architect" },
  { id: "intelligence", label: "Intelligence" },
];

const ADMIN_SECTION: NavSection = { id: "admin", label: "Admin" };

interface Props {
  theme: ThemeManager;
  i18n: LocalizationShell;
  adminEnabled?: boolean;
}

export function NavBar({ theme, i18n, adminEnabled = false }: Props) {
  const [activeSection, setActiveSection] = useState<string>("calculator");
  const visibleSections = adminEnabled ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    visibleSections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -50% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="navbar" aria-label="FiceCal sections">
      <div className="navbar-brand">
        <span className="navbar-eyebrow">{i18n.t("ui.title")}</span>
        <span className="navbar-tagline">{i18n.t("ui.tagline")}</span>
      </div>

      <ul className="navbar-links" role="list">
        {visibleSections.map(({ id, label }) => (
          <li key={id}>
            <button
              className={`navbar-link${activeSection === id ? " is-active" : ""}`}
              onClick={() => scrollTo(id)}
              aria-current={activeSection === id ? "location" : undefined}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {/* Phase 7: full theme picker with all plugin-contributed themes */}
      <ThemePicker theme={theme} />
    </nav>
  );
}
