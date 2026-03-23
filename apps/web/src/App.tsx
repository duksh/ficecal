// ─── App ──────────────────────────────────────────────────────────────────────
//
// Phase 12: full single-page layout — all panels visible simultaneously.
// NavBar for smooth-scroll anchoring, ScenarioBar for preset loading,
// economicsResult lifted from CostEstimator into HealthDashboard,
// routingOutput lifted from IntelligencePanel into ArchitectPanel.
//
// Admin panel gated behind ?admin=1 URL param (G-M5).

import { useState, useEffect } from "react";
import type { SharedContext } from "./types.js";
import { useUiFoundation } from "./hooks/useUiFoundation.js";
import { SharedContextForm } from "./components/SharedContextForm.js";
import { CostEstimator } from "./components/CostEstimator.js";
import { HealthDashboard } from "./components/HealthDashboard.js";
import { ArchitectPanel } from "./components/ArchitectPanel.js";
import { CarbonPanel } from "./components/CarbonPanel.js";
import { CommitmentPanel } from "./components/CommitmentPanel.js";
import { NavBar } from "./components/NavBar.js";
import { DevBanner } from "./components/DevBanner.js";
import { ScenarioBar } from "./components/ScenarioBar.js";
import { AdminPanel } from "./components/AdminPanel.js";
import { IntelligencePanel } from "./components/IntelligencePanel.js";
import type { RoutingOutput } from "./components/IntelligencePanel.js";
import type { AiCostResult } from "@ficecal/ai-token-economics";
import type { DemoScenario } from "@ficecal/demo-scenarios";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT: SharedContext = {
  workspaceId: "workspace-finops-001",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  currency: "MUR",
};

// Admin panel is visible when ?admin=1 is in the URL (G-M5).
const ADMIN_ENABLED =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("admin") === "1";

// ─── Component ────────────────────────────────────────────────────────────────

export function App() {
  const { theme, i18n, preferences, pluginHost } = useUiFoundation();

  const [context, setContext] = useState<SharedContext>(DEFAULT_CONTEXT);
  const [economicsResult, setEconomicsResult] = useState<AiCostResult | null>(null);
  const [activeScenario, setActiveScenario] = useState<DemoScenario | null>(null);
  const [routingOutput, setRoutingOutput] = useState<RoutingOutput | null>(null);

  // Keep currency preference in sync with context currency.
  useEffect(() => {
    const prefs = preferences.get();
    if (prefs.currency !== context.currency) {
      preferences.set("currency", context.currency as typeof prefs.currency);
    }
  }, [context.currency, preferences]);

  // Apply the initial theme on mount (no-FWOT).
  useEffect(() => {
    theme.apply();
  }, [theme]);

  function handleScenarioLoad(scenario: DemoScenario) {
    setActiveScenario(scenario);
    const overrideCurrency = scenario.inputs?.aiCost?.currency;
    if (overrideCurrency && typeof overrideCurrency === "string") {
      setContext((c) => ({ ...c, currency: overrideCurrency }));
    }
  }

  return (
    <div className="shell">
      <DevBanner />
      <NavBar theme={theme} i18n={i18n} adminEnabled={ADMIN_ENABLED} />

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-brand">
          <p className="eyebrow">{i18n.t("ui.title")} v2</p>
          <h1>{i18n.t("ui.tagline")}</h1>
          <p className="hero-sub">
            Deterministic cost intelligence for FinOps practitioners —
            decimal-precise, audit-traceable, FOCUS 1.3 conformant.
          </p>
        </div>
        <div className="hero-meta">
          <span className="phase-tag">Phase 12 · 15 MCP tools · FOCUS 1.3 · FinOps Framework 2026</span>
          <span className="phase-tag phase-tag--muted">decimal.js 28dp</span>
          <span className="phase-tag phase-tag--muted">formula-traced</span>
          <span className="phase-tag phase-tag--muted">plugin-extensible</span>
        </div>

        {/* ── Onboarding quick-start (G-L1) ──────────────────────────────── */}
        <div className="onboarding-cta" role="region" aria-label="Quick start scenarios">
          <p className="onboarding-label">👋 New here? Start with a scenario:</p>
          <div className="onboarding-chips">
            {[
              { id: "ai-cost-spike",      label: "AI cost spike",       emoji: "🚨" },
              { id: "multi-cloud-spread", label: "Multi-cloud spread",   emoji: "☁️" },
              { id: "commitment-waste",   label: "Commitment waste",     emoji: "💸" },
              { id: "carbon-reduction",   label: "Carbon reduction",     emoji: "🌱" },
              { id: "budget-overrun",     label: "Budget overrun",       emoji: "📊" },
              { id: "finops-maturity",    label: "FinOps maturity",      emoji: "📈" },
            ].map(s => (
              <button
                key={s.id}
                className="onboarding-chip"
                onClick={() => {
                  // Scroll ScenarioBar into view so user can pick the scenario
                  document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
                }}
                title={`Load ${s.label} scenario`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Workspace context ────────────────────────────────────────────────── */}
      <SharedContextForm context={context} onChange={setContext} />

      {/* ── Scenario presets ─────────────────────────────────────────────────── */}
      <ScenarioBar
        onLoad={handleScenarioLoad}
        activeId={activeScenario?.id}
      />

      <main className="content-area" role="main">
        {/* ── Cost estimator ──────────────────────────────────────────────── */}
        <section id="calculator" className="anchor-section">
          <CostEstimator
            context={context}
            onResult={setEconomicsResult}
            scenarioOverride={activeScenario}
          />
        </section>

        {/* ── Commitment management (G-M4) ────────────────────────────────── */}
        <section id="commitments" className="anchor-section">
          <CommitmentPanel context={context} />
        </section>

        {/* ── Health dashboard ────────────────────────────────────────────── */}
        <section id="health" className="anchor-section">
          <HealthDashboard
            context={context}
            economicsResult={economicsResult}
          />
        </section>

        {/* ── Carbon footprint (G-M3) ─────────────────────────────────────── */}
        <section id="carbon" className="anchor-section">
          <CarbonPanel context={context} />
        </section>

        {/* ── Architect panel (G-H3: receives routing output) ─────────────── */}
        <section id="architect" className="anchor-section">
          <ArchitectPanel context={context} routingOptimizeOutput={routingOutput} />
        </section>

        {/* ── Intelligence panel ───────────────────────────────────────────── */}
        <section id="intelligence" className="anchor-section">
          <IntelligencePanel
            context={context}
            onRoutingResult={setRoutingOutput}
          />
        </section>

        {/* ── Admin panel — gated behind ?admin=1 (G-M5) ──────────────────── */}
        {ADMIN_ENABLED && (
          <section id="admin" className="anchor-section">
            <AdminPanel pluginHost={pluginHost} />
          </section>
        )}
      </main>

      <footer className="footer">
        <p>
          {i18n.t("ui.title")} v2 · Phase 12 · 15 MCP tools ·
          FOCUS 1.3 · FinOps Framework 2026 ·{" "}
          All arithmetic via <code>decimal.js</code> (28dp) · formula-traced ·{" "}
          <a
            href="https://github.com/duksh/ficecal/tree/develop"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--fc-accent)" }}
          >
            GitHub ↗
          </a>
        </p>
      </footer>
    </div>
  );
}
