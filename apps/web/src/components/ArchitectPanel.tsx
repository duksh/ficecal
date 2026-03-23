import type { SharedContext } from "../types.js";
import type { RoutingOutput } from "./IntelligencePanel.js";

interface Props {
  context: SharedContext;
  /** When provided, renders a "Model Routing Opportunities" section derived from
   *  the billing.routing.optimize MCP tool output. Pass null to hide. */
  routingOptimizeOutput?: RoutingOutput | null;
}

const PACKAGE_GRAPH = [
  // Phase 0
  { id: "schemas", phase: 0, provides: ["model-pricing-schema"], dependsOn: [] },
  { id: "integrations", phase: 0, provides: ["model-pricing-data"], dependsOn: ["schemas"] },
  { id: "schemas.normalized-cost-record", phase: 0, provides: ["billing-record-contract"], dependsOn: [] },
  // Phase 1
  { id: "core-economics", phase: 1, provides: ["cost-compute", "forex", "period-normalize"], dependsOn: [] },
  // Phase 2
  { id: "ai-token-economics", phase: 2, provides: ["ai-cost-compute"], dependsOn: ["core-economics"] },
  { id: "sla-slo-sli-economics", phase: 2, provides: ["error-budget", "downtime-cost", "reliability-roi"], dependsOn: ["core-economics"] },
  { id: "multi-tech-normalization", phase: 2, provides: ["tech-cost-normalize", "efficiency-index"], dependsOn: ["core-economics"] },
  { id: "chart-presentation", phase: 2, provides: ["chart-payload"], dependsOn: ["core-economics"] },
  { id: "health-score", phase: 2, provides: ["health-signals", "weighted-score"], dependsOn: [] },
  { id: "recommendation-module", phase: 2, provides: ["recommendations"], dependsOn: ["health-score"] },
  { id: "budgeting-forecasting", phase: 2, provides: ["budget-variance", "trend-extrapolation", "spend-projection"], dependsOn: ["core-economics"] },
  { id: "reference-evidence", phase: 2, provides: ["evidence-catalog", "queryable-citations"], dependsOn: [] },
  { id: "demo-scenarios", phase: 2, provides: ["canonical-fixtures"], dependsOn: ["ai-token-economics", "sla-slo-sli-economics", "budgeting-forecasting"] },
  { id: "qa-module", phase: 2, provides: ["contract-harness", "engine-contracts"], dependsOn: ["health-score"] },
  { id: "economics-module", phase: 2, provides: ["plugin-registry", "unified-economics-api"], dependsOn: ["ai-token-economics", "sla-slo-sli-economics", "multi-tech-normalization", "core-economics"] },
  // Phase 3
  { id: "ui-foundation", phase: 3, provides: ["intent-scope", "theme", "preferences", "i18n", "keyboard", "telemetry"], dependsOn: [] },
  { id: "feature-registry", phase: 3, provides: ["plugin-registration", "topo-sort"], dependsOn: [] },
  { id: "mcp-tooling", phase: 3, provides: ["mcp-tool-registry", "economics-tools"], dependsOn: ["feature-registry", "core-economics", "ai-token-economics", "health-score", "recommendation-module"] },
  // Phase 4
  { id: "contracts", phase: 4, provides: ["cross-package-boundary-types"], dependsOn: [] },
  { id: "service-mcp (scaffold)", phase: 4, provides: ["mcp-http-transport (planned)"], dependsOn: ["mcp-tooling"] },
];

const PHASE_TAGS: Record<number, string> = {
  0: "Phase 0 — baseline",
  1: "Phase 1 — economics kernel",
  2: "Phase 2 — module hardening",
  3: "Phase 3 — UI foundation & tooling",
  4: "Phase 4 — monorepo structure",
};

const ADR_ENTRIES = [
  { id: "ADR-0001", title: "D3-first chart rendering policy", status: "accepted" },
  { id: "ADR-0002", title: "Fastify + MCP SDK transport stack", status: "accepted" },
  { id: "ADR-0003", title: "Monorepo structure (apps/services/packages)", status: "accepted" },
  { id: "ADR-0004", title: "EconomicsPlugin extension interface for all economics engines", status: "accepted" },
  { id: "ADR-0005", title: "Decimal.js for all monetary arithmetic (28dp)", status: "accepted" },
  { id: "ADR-0006", title: "ForexRateProvider as injected named dependency", status: "accepted" },
  { id: "ADR-0007", title: "Formula registry for cost computation traceability", status: "accepted" },
];

export function ArchitectPanel({ context, routingOptimizeOutput }: Props) {
  return (
    <div className="panel-stack">
      {/* ── Context trace ────────────────────────────────────────────────── */}
      <section className="panel" aria-label="Context trace">
        <h2>Context Trace</h2>
        <ul className="status-list">
          <li><span className="label">Workspace</span><code>{context.workspaceId}</code></li>
          <li><span className="label">Period</span><span>{context.startDate} → {context.endDate}</span></li>
          <li><span className="label">Currency</span><code>{context.currency}</code></li>
          <li><span className="label">feature-catalog</span><code>v1.6.0</code></li>
          <li>
            <span className="label">Phase exit tags</span>
            <span>phase-0 · phase-1 · phase-2 · phase-3 · phase-4 (in progress)</span>
          </li>
        </ul>
      </section>

      {/* ── Package graph ────────────────────────────────────────────────── */}
      <section className="panel" aria-label="Package dependency graph">
        <h2>Package Graph</h2>
        {Object.entries(PHASE_TAGS).map(([phase, label]) => {
          const pkgs = PACKAGE_GRAPH.filter((p) => p.phase === Number(phase));
          if (pkgs.length === 0) return null;
          return (
            <div key={phase} className="phase-group">
              <h3 className="phase-label">{label}</h3>
              <ul className="pkg-list">
                {pkgs.map((pkg) => (
                  <li key={pkg.id} className="pkg-item">
                    <div className="pkg-header">
                      <code className="pkg-id">{pkg.id}</code>
                      <span className="status-dot status-dot--active" aria-label="active" />
                    </div>
                    <div className="pkg-meta">
                      <span>Provides: {pkg.provides.join(", ")}</span>
                      {pkg.dependsOn.length > 0 && (
                        <span>Depends on: {pkg.dependsOn.join(", ")}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ── ADRs ─────────────────────────────────────────────────────────── */}
      <section className="panel" aria-label="Architecture decision records">
        <h2>Architecture Decisions</h2>
        <ul className="adr-list">
          {ADR_ENTRIES.map((adr) => (
            <li key={adr.id} className="adr-item">
              <code>{adr.id}</code>
              <span>{adr.title}</span>
              <span className="adr-status">{adr.status}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Model Routing Opportunities (U1) ─────────────────────────────── */}
      {routingOptimizeOutput !== null && routingOptimizeOutput !== undefined && (
        <section className="panel" aria-label="Model routing opportunities">
          <h2>💡 Model Routing Opportunities</h2>
          {routingOptimizeOutput.opportunities.length === 0 ? (
            <p className="hint" style={{ color: "var(--fc-text-muted)" }}>
              Run billing.routing.optimize to see model swap opportunities.
            </p>
          ) : (
            <>
              <p className="hint" style={{ color: "var(--fc-text-muted)", marginBottom: "0.75rem", fontSize: "0.82rem" }}>
                {routingOptimizeOutput.opportunitiesFound} opportunit{routingOptimizeOutput.opportunitiesFound === 1 ? "y" : "ies"} found ·{" "}
                estimated{" "}
                <strong style={{ color: "var(--fc-ok)" }}>
                  {routingOptimizeOutput.totalEstimatedMonthlySaving} /mo
                </strong>
              </p>
              <ul className="adr-list">
                {routingOptimizeOutput.opportunities.slice(0, 3).map((opp, idx) => {
                  const best = opp.alternatives[0];
                  return (
                    <li key={idx} className="adr-item" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                        {opp.sourceDisplayName}
                      </span>
                      {best && (
                        <>
                          <span style={{ color: "var(--fc-text-muted)" }}>→</span>
                          <span style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>
                            {best.displayName}
                          </span>
                        </>
                      )}
                      <span style={{ color: "var(--fc-ok)", fontWeight: 600 }}>
                        save {opp.bestAlternativeSaving}/mo
                      </span>
                      {best?.notes && (
                        <span
                          className="hint"
                          style={{ width: "100%", marginTop: "0.15rem", fontSize: "0.78rem" }}
                          title={best.notes}
                        >
                          {best.notes.length > 70
                            ? best.notes.slice(0, 70) + "…"
                            : best.notes}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
}
