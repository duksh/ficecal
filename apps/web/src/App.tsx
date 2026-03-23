// ─── App ──────────────────────────────────────────────────────────────────────
//
// Phase 4: full single-page layout — all four panels visible simultaneously,
// NavBar for smooth-scroll anchoring, ScenarioBar for preset loading,
// economicsResult lifted from CostEstimator into HealthDashboard.

import { useState, useEffect } from "react";
import type { SharedContext } from "./types.js";
import { useUiFoundation } from "./hooks/useUiFoundation.js";
import { SharedContextForm } from "./components/SharedContextForm.js";
import { CostEstimator } from "./components/CostEstimator.js";
import { HealthDashboard } from "./components/HealthDashboard.js";
import { ArchitectPanel } from "./components/ArchitectPanel.js";
import { NavBar } from "./components/NavBar.js";
import { DevBanner } from "./components/DevBanner.js";
import { ScenarioBar } from "./components/ScenarioBar.js";
import { AdminPanel } from "./components/AdminPanel.js";
import { IntelligencePanel } from "./components/IntelligencePanel.js";
import type { AiCostResult } from "@ficecal/ai-token-economics";
import type { DemoScenario } from "@ficecal/demo-scenarios";

const DEFAULT_CONTEXT: SharedContext = {
  workspaceId: "workspace-finops-001",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  currency: "MUR",
};

export function App() {
  const { theme, i18n, preferences, pluginHost } = useUiFoundation();

  const [context, setContext] = useState<SharedContext>(DEFAULT_CONTEXT);
  const [economicsResult, setEconomicsResult] = useState<AiCostResult | null>(null);
  const [activeScenario, setActiveScenario] = useState<DemoScenario | null>(null);

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
    // If scenario has a currency override, apply it to context
    const overrideCurrency = scenario.inputs?.aiCost?.currency;
    if (overrideCurrency && typeof overrideCurrency === "string") {
      setContext((c) => ({ ...c, currency: overrideCurrency }));
    }
  }

  return (
    <div className="shell">
      <DevBanner />
      <NavBar theme={theme} i18n={i18n} />

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-brand">
          <p className="eyebrow">{i18n.t("ui.title")} v2</p>
          <h1>{i18n.t("ui.tagline")}</h1>
          <p className="hero-sub">
            Deterministic cost intelligence — decimal-precise, audit-traceable.
          </p>
        </div>
        <div className="hero-meta">
          <span className="phase-tag">Phase 10 — Intelligence Layer · AI Routing · Anomaly Detection · FOCUS 1.3</span>
          <span className="phase-tag phase-tag--muted">decimal.js 28dp</span>
          <span className="phase-tag phase-tag--muted">formula-traced</span>
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

        {/* ── Health dashboard ────────────────────────────────────────────── */}
        <section id="health" className="anchor-section">
          <HealthDashboard
            context={context}
            economicsResult={economicsResult}
          />
        </section>

        {/* ── Architect panel ─────────────────────────────────────────────── */}
        <section id="architect" className="anchor-section">
          <ArchitectPanel context={context} />
        </section>

        {/* ── Intelligence panel ───────────────────────────────────────────── */}
        <section id="intelligence" className="anchor-section">
          <IntelligencePanel context={context} />
        </section>

        {/* ── Admin panel ──────────────────────────────────────────────────── */}
        <section id="admin" className="anchor-section">
          <AdminPanel pluginHost={pluginHost} />
        </section>
      </main>

      <footer className="footer">
        <p>
          {i18n.t("ui.title")} v2 · Phase 10 · All arithmetic via{" "}
          <code>decimal.js</code> (28dp) · formula-traced
        </p>
      </footer>
    </div>
  );
}
