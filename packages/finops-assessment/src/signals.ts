// ─── AssessmentSignals — workspace capability flag input ──────────────────────
//
// AssessmentSignals is the input shape for the FinOps assessment engine.
// Each boolean flag represents a FinOps practice that the workspace either
// has in place (true) or does not (false / undefined).
//
// Flags are grouped by FinOps Framework 2026 capability domain.  All flags are
// optional — missing flags are treated as "not implemented" (false) to allow
// partial signal sets from early-stage workspaces.

// ─── Domain 1 · Understand Cloud Usage & Cost ────────────────────────────────

export interface UnderstandSignals {
  /** Cost allocation tags are defined and enforced across resources. */
  hasTaggingPolicy?: boolean;

  /** Shared cost (e.g. support, enterprise discount) is allocated to teams. */
  hasSharedCostAllocation?: boolean;

  /** A cloud cost dashboard is available and reviewed at least monthly. */
  hasCostDashboard?: boolean;

  /** Unit economics metrics (cost per request, per user, per GB) are tracked. */
  hasUnitEconomics?: boolean;

  /** Anomaly detection alerts are active for cost spikes. */
  hasAnomalyDetection?: boolean;
}

// ─── Domain 2 · Quantify Business Value ──────────────────────────────────────

export interface QuantifySignals {
  /** Cloud spend is mapped to business products or revenue lines. */
  hasProductCostMapping?: boolean;

  /** Unit cost trends are reported to leadership at least quarterly. */
  hasExecutiveReporting?: boolean;

  /** ROI or payback period is tracked for major cloud investments. */
  hasRoiTracking?: boolean;

  /** Showback or chargeback is in place for internal cost allocation. */
  hasShowbackOrChargeback?: boolean;
}

// ─── Domain 3 · Optimize Cloud Usage & Cost ──────────────────────────────────

export interface OptimizeSignals {
  /** Reserved instances, savings plans, or CUDs are purchased and managed. */
  hasCommitmentCoverage?: boolean;

  /** Rightsizing recommendations are reviewed and actioned each month. */
  hasRightsizing?: boolean;

  /** Idle and unattached resources are identified and removed regularly. */
  hasWasteRemediation?: boolean;

  /** Spot or preemptible instances are used where workload allows. */
  hasSpotUsage?: boolean;

  /** Storage lifecycle policies are defined for tiering / expiry. */
  hasStorageLifecycle?: boolean;
}

// ─── Domain 4 · Manage the FinOps Practice ───────────────────────────────────

export interface ManagePracticeSignals {
  /** A FinOps team or function is established (dedicated or virtual). */
  hasFinOpsTeam?: boolean;

  /** Cloud cost budgets are set and reviewed against actuals each month. */
  hasBudgetProcess?: boolean;

  /** FinOps KPIs are tracked and reported (e.g. utilisation rate, waste %). */
  hasKpiTracking?: boolean;

  /** Engineering teams have self-serve cost visibility for their services. */
  hasEngineerVisibility?: boolean;

  /** A FinOps maturity review is conducted at least annually. */
  hasMaturityReview?: boolean;
}

// ─── Domain 5 · Cloud Sustainability ─────────────────────────────────────────

export interface SustainabilitySignals {
  /** Carbon emissions data is available per workload or service. */
  hasCarbonVisibility?: boolean;

  /** Sustainability targets or SLOs are set for cloud workloads. */
  hasSustainabilityTargets?: boolean;

  /** Region selection considers carbon intensity as a decision factor. */
  hasGreenRegionPolicy?: boolean;
}

// ─── Domain 6 · AI / ML Cost Management ──────────────────────────────────────

export interface AiMlSignals {
  /** AI/ML model inference costs are tracked at the model or endpoint level. */
  hasAiCostVisibility?: boolean;

  /** Token usage and per-request cost are attributed to consuming teams. */
  hasTokenAttribution?: boolean;

  /** Model selection is evaluated on cost-per-quality trade-offs. */
  hasModelCostOptimization?: boolean;

  /** AI/ML cost budgets and alerts are in place. */
  hasAiCostAlerts?: boolean;
}

// ─── Combined input ───────────────────────────────────────────────────────────

/**
 * Full set of workspace assessment signals consumed by the scoring engine.
 * All groups are optional — omitting a group means no signals for that domain.
 */
export interface AssessmentSignals {
  understand?: UnderstandSignals;
  quantify?: QuantifySignals;
  optimize?: OptimizeSignals;
  managePractice?: ManagePracticeSignals;
  sustainability?: SustainabilitySignals;
  aiMl?: AiMlSignals;
}
