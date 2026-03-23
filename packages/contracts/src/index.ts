/**
 * @ficecal/contracts — canonical cross-package boundary types
 *
 * This package defines the shared contract types that cross package
 * boundaries in the FiceCal v2 monorepo. No business logic lives here —
 * only plain TypeScript interfaces and discriminated unions.
 *
 * Consuming packages import from here rather than from each other's
 * internal types, preventing circular dependencies and making
 * contract drift detectable at the boundary.
 */

// ─── FinOps context ───────────────────────────────────────────────────────────

export interface WorkspaceContext {
  /** Stable workspace identifier */
  workspaceId: string;
  /** ISO date string — start of analysis period */
  startDate: string;
  /** ISO date string — end of analysis period */
  endDate: string;
  /** ISO 4217 currency code */
  currency: string;
}

// ─── Intent / Scope / Mode ────────────────────────────────────────────────────

export type Intent = "viability" | "operations" | "architecture" | "executive";
export type Scope =
  | "baseline-unit-economics"
  | "optimization-opportunities"
  | "architecture-tradeoffs"
  | "executive-strategy";
export type Mode = "quick" | "operator" | "architect";

export interface IntentScopeSnapshot {
  intent: Intent;
  scope: Scope;
  mode: Mode;
}

// ─── Economics result boundary ────────────────────────────────────────────────

/**
 * Minimal economics result shape that crosses from compute packages → UI.
 * Full types live in their respective packages; this is the cross-boundary subset.
 */
export interface EconomicsResultSummary {
  domain: string;
  totalCost: string;
  currency: string;
  period: string;
  formulasApplied: string[];
  warnings: string[];
  computedAt: string;
}

// ─── Health signal boundary ───────────────────────────────────────────────────

export type SignalSeverity = "ok" | "warning" | "critical";

export interface HealthSignalSummary {
  id: string;
  category: string;
  label: string;
  score: number;
  severity: SignalSeverity;
  rationale: string;
}

export interface HealthScoreSummary {
  weightedScore: number;
  overallSeverity: SignalSeverity;
  signalCount: number;
  computedAt: string;
}

// ─── Recommendation boundary ──────────────────────────────────────────────────

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface RecommendationSummary {
  id: string;
  title: string;
  action: string;
  priority: RecommendationPriority;
  audience: string;
}

// ─── Telemetry boundary ───────────────────────────────────────────────────────

export interface TelemetryBase {
  name: string;
  ts: number;
  sessionId: string;
}

// ─── FinOps Framework 2026 assessment types ───────────────────────────────────
//
// The FinOps Framework 2026 organises maturity across six capability domains.
// These types provide cross-package boundary contracts for assessment results.
// Full assessment logic lives in packages/qa-module; this is the boundary subset.

/**
 * The six FinOps Framework 2026 capability domains.
 * Each domain groups related FinOps practices and assessment criteria.
 */
export type FinOpsCapabilityDomain =
  | "understand-cloud-usage-cost"
  | "quantify-business-value"
  | "optimize-cloud-usage-cost"
  | "manage-finops-practice"
  | "cloud-sustainability"
  | "ai-ml-cost-management";

/**
 * FinOps Framework 2026 maturity levels for each capability domain.
 *
 * - "crawl" : Ad hoc, reactive; minimal tooling; cost visibility is limited
 * - "walk"  : Repeatable processes; dashboards established; tagging enforced
 * - "run"   : Proactive; automated; benchmarked; cross-functional FinOps culture
 */
export type FinOpsMaturityLevel = "crawl" | "walk" | "run";

/**
 * A single capability assessment result for one FinOps Framework domain.
 */
export interface FinOpsCapabilityAssessment {
  /** The domain being assessed. */
  domain: FinOpsCapabilityDomain;

  /** Human-readable display name of the domain. */
  domainName: string;

  /** Assessed maturity level for this domain. */
  maturityLevel: FinOpsMaturityLevel;

  /**
   * Score 0–100 within the maturity level.
   * 0–33 = lower crawl/walk/run; 34–66 = mid; 67–100 = upper.
   */
  score: number;

  /**
   * Key findings that informed this maturity assessment.
   * Each entry is a short signal sentence (max 120 chars).
   */
  findings: string[];

  /**
   * Recommended next actions to advance maturity within this domain.
   * Ordered by impact (highest impact first).
   */
  recommendations: string[];

  /** ISO 8601 timestamp when this assessment was last computed. */
  assessedAt: string;
}

/**
 * Aggregate FinOps Framework 2026 assessment across all six domains.
 */
export interface FinOpsFrameworkAssessment {
  /** Workspace this assessment applies to. */
  workspaceId: string;

  /** FiceCal schema version for this assessment. Currently "2026.1". */
  assessmentVersion: string;

  /** ISO 8601 period start the assessment covers. */
  periodStart: string;

  /** ISO 8601 period end the assessment covers. */
  periodEnd: string;

  /** Per-domain capability assessments (one per domain). */
  capabilities: FinOpsCapabilityAssessment[];

  /**
   * Overall maturity level — the modal level across all domains
   * (tie-broken by lowest level if bimodal).
   */
  overallMaturityLevel: FinOpsMaturityLevel;

  /**
   * Aggregate FinOps score 0–100, computed as the weighted average
   * of individual domain scores.
   */
  overallScore: number;

  /**
   * Top 3 priority recommendations across all domains, surfaced for
   * executive-level reporting.
   */
  topRecommendations: string[];

  /** ISO 8601 timestamp when the full assessment was computed. */
  computedAt: string;
}

/**
 * FinOps benchmark comparison — compares a workspace's assessment against
 * anonymised industry peer benchmarks.
 *
 * Peer data is sourced from the FinOps Foundation's Annual State of FinOps
 * survey and FiceCal's anonymised customer cohort.
 */
export interface FinOpsBenchmarkComparison {
  /** Workspace being benchmarked. */
  workspaceId: string;

  /**
   * Industry peer group used for comparison.
   * Based on cloud spend tier, industry vertical, and headcount.
   */
  peerGroup: string;

  /** The workspace's own assessment (pre-computed). */
  workspaceAssessment: Pick<FinOpsFrameworkAssessment,
    "overallMaturityLevel" | "overallScore" | "capabilities">;

  /**
   * Peer group median maturity level per domain.
   * Keys are FinOpsCapabilityDomain values.
   */
  peerMedianByDomain: Record<FinOpsCapabilityDomain, FinOpsMaturityLevel>;

  /**
   * Domains where the workspace is ahead of the peer group median.
   */
  leaderDomains: FinOpsCapabilityDomain[];

  /**
   * Domains where the workspace lags behind the peer group median.
   */
  laggingDomains: FinOpsCapabilityDomain[];

  /** ISO 8601 timestamp when benchmark data was last refreshed. */
  benchmarkDataUpdatedAt: string;

  /** ISO 8601 timestamp when this comparison was computed. */
  computedAt: string;
}

/**
 * AI/ML Cost Management sub-assessment (FinOps Framework 2026 new domain).
 *
 * Covers GPU/TPU reservation optimisation, inference cost attribution,
 * model training amortisation, and token-level unit economics.
 */
export interface AiMlCostAssessment {
  /** Workspace this assessment applies to. */
  workspaceId: string;

  /** Whether token-level cost attribution is active. */
  tokenAttributionEnabled: boolean;

  /** Whether training job costs are amortised over model lifetime. */
  trainingAmortisationEnabled: boolean;

  /**
   * GPU/TPU commitment utilisation rate (0–1).
   * 1.0 = 100% of committed GPU/TPU capacity was used.
   */
  gpuCommitmentUtilisationRate: number | null;

  /**
   * Estimated monthly waste from over-provisioned AI infrastructure (USD).
   */
  estimatedMonthlyWaste: number;

  /**
   * Cost per 1M tokens (effective, across all LLM calls in the period).
   * Null if token-level tracking is not enabled.
   */
  costPerMillionTokens: number | null;

  /** Currency for all monetary fields. */
  currency: string;

  /** ISO 8601 timestamp when this assessment was computed. */
  computedAt: string;
}
