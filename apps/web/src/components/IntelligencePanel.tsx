// ─── IntelligencePanel ────────────────────────────────────────────────────────
//
// Phase 10A: UI surface for the three MCP intelligence tools.
//
//   Section 1 — AI Model Routing   (billing.routing.optimize)
//   Section 2 — Anomaly Detection  (billing.anomaly.detect)
//   Section 3 — Assessment × Billing Correlation (finops.assessment.correlate)
//
// Calls MCP service at VITE_MCP_BASE_URL (default: http://localhost:4001).
// All three tools are invoked in parallel on "Run analysis".

/// <reference types="vite/client" />
import { useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { SharedContext } from "../types.js";

// ─── MCP call helper ──────────────────────────────────────────────────────────

const MCP_BASE: string =
  (import.meta.env?.VITE_MCP_BASE_URL as string | undefined) ?? "http://localhost:4001";

async function callTool<T = Record<string, unknown>>(
  toolId: string,
  input: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${MCP_BASE}/mcp/v1/tools/${encodeURIComponent(toolId)}/call`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ toolId, requestId: `web-${toolId}-${Date.now()}`, input }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (body.error as Record<string, unknown>)?.message ?? `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  const data = await res.json() as { output: T };
  return data.output;
}

// ─── Baseline period (one calendar month prior to current period) ─────────────

function baselinePeriod(startDate: string): { start: string; end: string } {
  const d = new Date(startDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - 1);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end   = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

// ─── Output types (minimal — enough to render) ────────────────────────────────

interface ModelAlternative {
  modelId: string;
  provider: string;
  displayName: string;
  tier: string;
  estimatedMonthlySaving: string;
  savingPercent: number;
  notes: string;
}

export interface RoutingOpportunity {
  sourceModelId: string;
  sourceProvider: string;
  sourceDisplayName: string;
  sourceTier: string;
  observedSpend: string;
  alternatives: ModelAlternative[];
  bestAlternativeSaving: string;
}

export interface RoutingOutput {
  opportunities: RoutingOpportunity[];
  totalEstimatedMonthlySaving: string;
  modelsAnalysed: number;
  opportunitiesFound: number;
  providersCovered: string[];
  ingestMode: string;
  catalogVersion: string;
}

interface AnomalyRecord {
  serviceName: string;
  provider: string;
  currentSpend: string;
  baselineSpend: string;
  deltaPercent: number;
  deltaAmount: string;
  severity: "warning" | "critical";
  recommendation: string;
  projectedMonthlyOverage?: string;
}

interface AnomalyOutput {
  anomalies: AnomalyRecord[];
  anomalyCount: number;
  overallSeverity: "none" | "warning" | "critical";
  totalCurrentSpend: string;
  totalBaselineSpend: string;
  totalDeltaPercent: number;
  thresholdPercent: number;
  ingestMode: string;
}

interface CorrelatedRecommendation {
  id: string;
  domain: string;
  domainName: string;
  gapCapability: string;
  estimatedWaste: string;
  estimatedSaving: string;
  implementationEffort: "low" | "medium" | "high";
  roiScore: number;
  recommendation: string;
  affectedProviders: string[];
}

interface CorrelationOutput {
  workspaceId: string;
  overallScore: number;
  overallMaturityLevel: string;
  totalBillingSpend: string;
  aiProviderSpend: string;
  cloudProviderSpend: string;
  totalAddressableWaste: string;
  topAddressableGap: string;
  correlatedRecommendations: CorrelatedRecommendation[];
  correlationVersion: string;
  ingestMode: string;
}

// ─── State types ──────────────────────────────────────────────────────────────

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

// ─── Small display helpers ────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  reasoning: "var(--fc-crit)",
  premium:   "var(--fc-accent)",
  standard:  "var(--fc-ok)",
  economy:   "var(--fc-text-muted)",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Low effort", medium: "Medium effort", high: "High effort",
};

const SEVERITY_COLOR: Record<string, string> = {
  none: "var(--fc-ok)", warning: "var(--fc-warn)", critical: "var(--fc-crit)",
};

function fmt2(n: string | number): string {
  return parseFloat(String(n)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSaving(n: string): string {
  const v = parseFloat(n);
  return v > 0 ? `$${fmt2(v)}/mo` : "$0.00/mo";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  context: SharedContext;
  /** Current app mode — when it changes, an auto-trigger indicator is shown. */
  mode?: string;
  /** Called with routing optimize output so ArchitectPanel can display it. */
  onRoutingResult?: (output: RoutingOutput | null) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

// ─── MCP health + catalog freshness ─────────────────────────────────────────

interface McpHealth {
  version: string;
  phase: number;
  tools: number;
  catalogVersion?: string;
}

async function fetchHealth(): Promise<McpHealth> {
  const res = await fetch(`${MCP_BASE}/mcp/v1/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<McpHealth>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IntelligencePanel({ context, mode, onRoutingResult }: Props) {
  const [routing,     setRouting]     = useState<AsyncState<RoutingOutput>>({ status: "idle" });
  const [anomaly,     setAnomaly]     = useState<AsyncState<AnomalyOutput>>({ status: "idle" });
  const [correlation, setCorrelation] = useState<AsyncState<CorrelationOutput>>({ status: "idle" });
  const [health,      setHealth]      = useState<McpHealth | null>(null);

  // Fetch health + catalog version on mount for freshness indicator
  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => { /* service offline — silent */ });
  }, []);

  // ── Mode-change tracking (U2) ────────────────────────────────────────────
  const [lastAnalyzedMode, setLastAnalyzedMode] = useState<string | undefined>(mode);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const isMountRef = useRef(true);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-trigger with 300ms debounce when mode changes and analysis has already been run
  useEffect(() => {
    if (isMountRef.current) {
      isMountRef.current = false;
      return;
    }
    if (mode !== undefined && mode !== lastAnalyzedMode) {
      const hasRunAlready =
        routing.status !== "idle" || anomaly.status !== "idle" || correlation.status !== "idle";
      if (hasRunAlready) {
        // Clear any pending debounce
        if (debounceTimeoutRef.current !== null) {
          clearTimeout(debounceTimeoutRef.current);
        }
        setIsAutoAnalyzing(true);
        debounceTimeoutRef.current = setTimeout(() => {
          setIsAutoAnalyzing(false);
          void runAnalysis();
        }, 300);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const runAnalysis = useCallback(async () => {
    const { start: bStart, end: bEnd } = baselinePeriod(context.startDate);
    const aiProviders = ["anthropic", "openai", "gemini", "mistral", "deepseek", "alibaba"];

    setRouting({ status: "loading" });
    setAnomaly({ status: "loading" });
    setCorrelation({ status: "loading" });

    // ── All three tools in parallel ──────────────────────────────────────────
    const [routeResult, anomalyResult, corrResult] = await Promise.allSettled([
      callTool<RoutingOutput>("billing.routing.optimize", {
        periodStart: context.startDate,
        periodEnd:   context.endDate,
        topN:        5,
      }),
      callTool<AnomalyOutput>("billing.anomaly.detect", {
        providers:           aiProviders,
        currentPeriodStart:  context.startDate,
        currentPeriodEnd:    context.endDate,
        baselinePeriodStart: bStart,
        baselinePeriodEnd:   bEnd,
        thresholdPercent:    50,
      }),
      callTool<CorrelationOutput>("finops.assessment.correlate", {
        periodStart: context.startDate,
        periodEnd:   context.endDate,
        workspaceId: context.workspaceId,
      }),
    ]);

    const routingState: AsyncState<RoutingOutput> =
      routeResult.status === "fulfilled"
        ? { status: "ok",    data:    routeResult.value }
        : { status: "error", message: routeResult.reason instanceof Error ? routeResult.reason.message : "Failed" };
    setRouting(routingState);
    // Lift routing result up so ArchitectPanel can display model routing opportunities
    onRoutingResult?.(routeResult.status === "fulfilled" ? routeResult.value : null);
    setAnomaly(
      anomalyResult.status === "fulfilled"
        ? { status: "ok",    data:    anomalyResult.value }
        : { status: "error", message: anomalyResult.reason instanceof Error ? anomalyResult.reason.message : "Failed" }
    );
    setCorrelation(
      corrResult.status === "fulfilled"
        ? { status: "ok",    data:    corrResult.value }
        : { status: "error", message: corrResult.reason instanceof Error ? corrResult.reason.message : "Failed" }
    );

    // Record the mode at which analysis last ran
    setLastAnalyzedMode(mode);
  }, [context, mode]);

  const isRunning =
    routing.status === "loading" ||
    anomaly.status === "loading" ||
    correlation.status === "loading";

  const hasRun = routing.status !== "idle" || anomaly.status !== "idle";

  // Show pulsing indicator when mode has changed since last analysis was run
  const modeChangedSinceLastRun =
    hasRun &&
    mode !== undefined &&
    lastAnalyzedMode !== undefined &&
    mode !== lastAnalyzedMode;

  return (
    <div className="panel-stack">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="panel intel-header">
        <div className="panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Intelligence</h2>
            {health && (
              <span
                className="phase-tag phase-tag--muted"
                title={`MCP service v${health.version} · ${health.tools} tools`}
                style={{ fontSize: "0.72rem" }}
              >
                🟢 MCP {health.version}
                {health.catalogVersion ? ` · catalog ${health.catalogVersion}` : ""}
              </span>
            )}
          </div>
          <p className="hint">
            Phase 12 · AI model routing · Spend anomaly detection · Assessment correlation
          </p>
        </div>
        <div className="intel-meta-row">
          <span className="intel-meta-chip">
            Period: <strong>{context.startDate}</strong> → <strong>{context.endDate}</strong>
          </span>
          <span className="intel-meta-chip">
            Workspace: <strong>{context.workspaceId}</strong>
          </span>
          <span className="intel-meta-chip intel-meta-chip--muted">
            Baseline: {baselinePeriod(context.startDate).start} → {baselinePeriod(context.startDate).end}
          </span>
        </div>
        <button
          className="intel-run-btn"
          onClick={runAnalysis}
          disabled={isRunning}
          aria-busy={isRunning}
        >
          {modeChangedSinceLastRun && (
            <span
              className="intel-mode-dot"
              aria-label="Mode changed — re-run recommended"
              title={`Mode changed to "${mode}" — re-run analysis for updated results`}
              style={{
                display: "inline-block",
                width: "0.55rem",
                height: "0.55rem",
                borderRadius: "50%",
                background: "var(--fc-warn, #f59e0b)",
                marginRight: "0.4rem",
                animation: "intel-pulse 1.2s ease-in-out infinite",
                verticalAlign: "middle",
              }}
            />
          )}
          {isRunning ? "Running…" : hasRun ? "Re-run analysis" : "Run intelligence analysis"}
        </button>
        {isAutoAnalyzing && (
          <p className="intel-idle-hint" style={{ color: "var(--fc-warn, #f59e0b)", marginTop: "0.35rem" }}>
            Auto-analyzing… mode changed to <strong>{mode}</strong>
          </p>
        )}
        {!hasRun && (
          <p className="intel-idle-hint">
            Calls MCP service at <code>{MCP_BASE}</code> — ensure the service is running.
          </p>
        )}
      </div>

      {/* ── Section 1 — AI Model Routing ────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <h3>AI Model Routing</h3>
          <p className="hint">
            Identifies cheaper equivalent models for your current AI spend.{" "}
            <code>billing.routing.optimize</code>
          </p>
        </div>
        <IntelSection state={routing}>
          {(data) => (
            <>
              <div className="intel-hero-row">
                <div className="intel-hero-stat">
                  <span className="intel-hero-value intel-hero-value--saving">
                    {fmtSaving(data.totalEstimatedMonthlySaving)}
                  </span>
                  <span className="intel-hero-label">total estimated monthly saving</span>
                </div>
                <div className="intel-hero-stat">
                  <span className="intel-hero-value">{data.opportunitiesFound}</span>
                  <span className="intel-hero-label">
                    {data.opportunitiesFound === 1 ? "opportunity" : "opportunities"} found
                    {" "}/ {data.modelsAnalysed} models analysed
                  </span>
                </div>
                <div className="intel-hero-stat">
                  <span className="intel-hero-value intel-hero-value--muted">
                    {data.providersCovered.length}
                  </span>
                  <span className="intel-hero-label">
                    {data.providersCovered.join(", ")}
                  </span>
                </div>
              </div>

              {data.opportunities.length === 0 ? (
                <p className="intel-empty">No routing opportunities found for this period.</p>
              ) : (
                <ul className="intel-list" role="list">
                  {data.opportunities.map((opp) => {
                    const best = opp.alternatives[0];
                    return (
                      <li key={opp.sourceModelId} className="intel-item intel-item--routing">
                        <div className="intel-routing-source">
                          <span
                            className="intel-tier-badge"
                            style={{ borderColor: TIER_COLOR[opp.sourceTier] ?? "var(--fc-border)", color: TIER_COLOR[opp.sourceTier] ?? "var(--fc-text-muted)" }}
                          >
                            {opp.sourceTier}
                          </span>
                          <span className="intel-model-name">{opp.sourceDisplayName}</span>
                          <span className="intel-model-provider">{opp.sourceProvider}</span>
                          <span className="intel-spend-label">
                            Observed: <strong>${fmt2(opp.observedSpend)}</strong>/mo
                          </span>
                        </div>
                        {best && (
                          <div className="intel-routing-alt">
                            <span className="intel-arrow">→</span>
                            <span
                              className="intel-tier-badge"
                              style={{ borderColor: TIER_COLOR[best.tier] ?? "var(--fc-border)", color: TIER_COLOR[best.tier] ?? "var(--fc-text-muted)" }}
                            >
                              {best.tier}
                            </span>
                            <span className="intel-model-name">{best.displayName}</span>
                            <span className="intel-model-provider">{best.provider}</span>
                            <span className="intel-saving-badge">
                              −{best.savingPercent.toFixed(1)}% · save {fmtSaving(best.estimatedMonthlySaving)}
                            </span>
                          </div>
                        )}
                        {best?.notes && (
                          <p className="intel-item-note">{best.notes}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="intel-footnote">
                Catalog: {data.catalogVersion} · Mode: {data.ingestMode}
              </p>
            </>
          )}
        </IntelSection>
      </div>

      {/* ── Section 2 — Anomaly Detection ───────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <h3>Spend Anomaly Detection</h3>
          <p className="hint">
            Compares current period spend vs previous month baseline.{" "}
            <code>billing.anomaly.detect</code>
          </p>
        </div>
        <IntelSection state={anomaly}>
          {(data) => (
            <>
              <div className="intel-hero-row">
                <div className="intel-hero-stat">
                  <span
                    className="intel-hero-value"
                    style={{ color: SEVERITY_COLOR[data.overallSeverity] }}
                  >
                    {data.overallSeverity.toUpperCase()}
                  </span>
                  <span className="intel-hero-label">overall severity</span>
                </div>
                <div className="intel-hero-stat">
                  <span className="intel-hero-value">{data.anomalyCount}</span>
                  <span className="intel-hero-label">
                    {data.anomalyCount === 1 ? "anomaly" : "anomalies"} detected
                    {" "}(threshold: {data.thresholdPercent}%)
                  </span>
                </div>
                <div className="intel-hero-stat">
                  <span className="intel-hero-value intel-hero-value--muted">
                    ${fmt2(data.totalCurrentSpend)}
                  </span>
                  <span className="intel-hero-label">
                    current vs ${fmt2(data.totalBaselineSpend)} baseline
                    ({data.totalDeltaPercent > 0 ? "+" : ""}{data.totalDeltaPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {data.anomalyCount === 0 ? (
                <p className="intel-empty" style={{ color: "var(--fc-ok)" }}>
                  ✓ No anomalies above {data.thresholdPercent}% threshold — spend is within normal range.
                </p>
              ) : (
                <ul className="intel-list" role="list">
                  {data.anomalies.map((a) => (
                    <li key={`${a.provider}-${a.serviceName}`} className="intel-item intel-item--anomaly">
                      <div className="intel-anomaly-header">
                        <span
                          className="intel-sev-badge"
                          style={{ background: SEVERITY_COLOR[a.severity] }}
                        >
                          {a.severity}
                        </span>
                        <span className="intel-model-name">{a.serviceName}</span>
                        <span className="intel-model-provider">{a.provider}</span>
                        <span className="intel-delta" style={{ color: SEVERITY_COLOR[a.severity] }}>
                          +{a.deltaPercent.toFixed(1)}% · +${fmt2(a.deltaAmount)}
                        </span>
                      </div>
                      <div className="intel-anomaly-spend">
                        Current: <strong>${fmt2(a.currentSpend)}</strong>
                        {" "}vs baseline: <strong>${fmt2(a.baselineSpend)}</strong>
                        {a.projectedMonthlyOverage && (
                          <span className="intel-projected">
                            {" "}· Projected overage: <strong>${fmt2(a.projectedMonthlyOverage)}/mo</strong>
                          </span>
                        )}
                      </div>
                      <p className="intel-item-note">{a.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </IntelSection>
      </div>

      {/* ── Section 3 — Assessment Correlation ──────────────────────────────── */}
      <div className="panel">
        <div className="panel-header">
          <h3>Assessment × Billing Correlation</h3>
          <p className="hint">
            FinOps capability gaps ranked by ROI against your actual spend.{" "}
            <code>finops.assessment.correlate</code>
          </p>
        </div>
        <IntelSection state={correlation}>
          {(data) => (
            <>
              <div className="intel-hero-row">
                <div className="intel-hero-stat">
                  <span className="intel-hero-value">{data.overallScore}</span>
                  <span className="intel-hero-label">
                    FinOps score / 100 · <strong>{data.overallMaturityLevel}</strong>
                  </span>
                </div>
                <div className="intel-hero-stat">
                  <span className="intel-hero-value intel-hero-value--saving">
                    ${fmt2(data.totalAddressableWaste)}/mo
                  </span>
                  <span className="intel-hero-label">total addressable waste</span>
                </div>
                <div className="intel-hero-stat">
                  <span className="intel-hero-value intel-hero-value--muted">
                    ${fmt2(data.totalBillingSpend)}
                  </span>
                  <span className="intel-hero-label">
                    total spend · AI: ${fmt2(data.aiProviderSpend)}
                    {" "}· Cloud: ${fmt2(data.cloudProviderSpend)}
                  </span>
                </div>
              </div>

              {data.topAddressableGap && (
                <div className="intel-top-gap">
                  <span className="intel-top-gap-label">Top gap:</span>
                  <strong>{data.topAddressableGap}</strong>
                </div>
              )}

              {data.correlatedRecommendations.length === 0 ? (
                <p className="intel-empty" style={{ color: "var(--fc-ok)" }}>
                  ✓ No addressable gaps found — all tracked capabilities are active.
                </p>
              ) : (
                <ul className="intel-list" role="list">
                  {data.correlatedRecommendations.slice(0, 7).map((rec) => (
                    <li key={rec.id} className="intel-item intel-item--corr">
                      <div className="intel-corr-header">
                        <span className="intel-roi-score">
                          ROI {rec.roiScore}
                        </span>
                        <span className="intel-domain-badge">{rec.domainName}</span>
                        <span
                          className="intel-effort-badge"
                          style={{
                            color: rec.implementationEffort === "low"
                              ? "var(--fc-ok)"
                              : rec.implementationEffort === "medium"
                              ? "var(--fc-warn)"
                              : "var(--fc-crit)",
                          }}
                        >
                          {EFFORT_LABEL[rec.implementationEffort]}
                        </span>
                      </div>
                      <div className="intel-corr-gap">
                        <strong>{rec.gapCapability}</strong>
                        <span className="intel-saving-badge">
                          save ${fmt2(rec.estimatedSaving)}/mo
                        </span>
                      </div>
                      <p className="intel-item-note">{rec.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="intel-footnote">
                Correlation v{data.correlationVersion} · Mode: {data.ingestMode} · Workspace: {data.workspaceId}
              </p>
            </>
          )}
        </IntelSection>
      </div>
    </div>
  );
}

// ─── IntelSection — loading / error / content wrapper ────────────────────────

interface IntelSectionProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
}

function IntelSection<T>({ state, children }: IntelSectionProps<T>) {
  if (state.status === "idle") {
    return (
      <p className="intel-idle-hint">Run the analysis above to see results.</p>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="intel-loading" aria-live="polite" aria-busy="true">
        <span className="intel-spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="intel-error" role="alert">
        <strong>Error:</strong> {state.message}
        <p className="intel-error-hint">
          Ensure the MCP service is running at <code>{MCP_BASE}</code> and try again.
        </p>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}
