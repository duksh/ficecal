// ─── finops.assessment.run — MCP tool ─────────────────────────────────────────
//
// Runs a FinOps Framework 2026 maturity assessment for a workspace.
// Accepts workspace capability signal flags and returns a full
// FinOpsFrameworkAssessment: per-domain scores, maturity levels, findings,
// recommendations, and top 3 cross-domain priorities.
//
// Tool id:   finops.assessment.run
// Namespace: finops
// Stability: beta
//
// ─── FinOps Framework 2026 capability domains ─────────────────────────────────
//
//   understand-cloud-usage-cost   · tagging, dashboards, anomaly detection
//   quantify-business-value       · product mapping, ROI, showback/chargeback
//   optimize-cloud-usage-cost     · commitments, rightsizing, waste, spot
//   manage-finops-practice        · team, budgets, KPIs, maturity reviews
//   cloud-sustainability          · carbon visibility, green region policy
//   ai-ml-cost-management         · token attribution, model optimisation
//
// ─── Maturity levels ──────────────────────────────────────────────────────────
//
//   crawl · score 0–33  · ad hoc, reactive, limited tooling
//   walk  · score 34–66 · repeatable, dashboards, tagging enforced
//   run   · score 67–100· proactive, automated, cross-functional FinOps culture
//
// Phase 9 — deterministic scoring from workspace signals.
// Live telemetry ingestion deferred to Phase 11.

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type {
  FinOpsFrameworkAssessment,
  FinOpsCapabilityAssessment,
} from "@ficecal/contracts";
import {
  computeAssessment,
} from "@ficecal/finops-assessment";
import type { AssessmentSignals } from "@ficecal/finops-assessment";

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface FinOpsAssessmentRunInput {
  /**
   * Workspace identifier to assess.
   * Defaults to "default" if omitted.
   */
  workspaceId?: string;

  /** ISO 8601 date — start of the assessment period. */
  periodStart: string;

  /** ISO 8601 date — end of the assessment period. */
  periodEnd: string;

  // ── Domain 1: Understand Cloud Usage & Cost ──────────────────────────────

  /** Cost allocation tags are defined and enforced across resources. */
  hasTaggingPolicy?: boolean;

  /** Shared costs (support, enterprise discounts) are allocated to teams. */
  hasSharedCostAllocation?: boolean;

  /** A cloud cost dashboard is available and reviewed at least monthly. */
  hasCostDashboard?: boolean;

  /** Unit economics metrics (cost-per-request, cost-per-user) are tracked. */
  hasUnitEconomics?: boolean;

  /** Anomaly detection alerts are active for cost spikes. */
  hasAnomalyDetection?: boolean;

  // ── Domain 2: Quantify Business Value ────────────────────────────────────

  /** Cloud spend is mapped to business products or revenue lines. */
  hasProductCostMapping?: boolean;

  /** Unit cost trends are reported to leadership at least quarterly. */
  hasExecutiveReporting?: boolean;

  /** ROI or payback periods are tracked for major cloud investments. */
  hasRoiTracking?: boolean;

  /** Showback or chargeback is in place for internal cost allocation. */
  hasShowbackOrChargeback?: boolean;

  // ── Domain 3: Optimize Cloud Usage & Cost ────────────────────────────────

  /** Reserved instances, savings plans, or CUDs are purchased and managed. */
  hasCommitmentCoverage?: boolean;

  /** Rightsizing recommendations are reviewed and actioned each month. */
  hasRightsizing?: boolean;

  /** Idle and unattached resources are identified and cleaned up regularly. */
  hasWasteRemediation?: boolean;

  /** Spot or preemptible instances are used where workload allows. */
  hasSpotUsage?: boolean;

  /** Storage lifecycle policies are defined for tiering and expiry. */
  hasStorageLifecycle?: boolean;

  // ── Domain 4: Manage the FinOps Practice ─────────────────────────────────

  /** A FinOps team or function is established (dedicated or virtual). */
  hasFinOpsTeam?: boolean;

  /** Cloud cost budgets are set and reviewed against actuals each month. */
  hasBudgetProcess?: boolean;

  /** FinOps KPIs are tracked and reported (utilisation rate, waste %). */
  hasKpiTracking?: boolean;

  /** Engineering teams have self-serve cost visibility for their services. */
  hasEngineerVisibility?: boolean;

  /** A FinOps maturity review is conducted at least annually. */
  hasMaturityReview?: boolean;

  // ── Domain 5: Cloud Sustainability ───────────────────────────────────────

  /** Carbon emissions data is available per workload or service. */
  hasCarbonVisibility?: boolean;

  /** Sustainability targets or SLOs are set for cloud workloads. */
  hasSustainabilityTargets?: boolean;

  /** Region selection considers carbon intensity as a decision factor. */
  hasGreenRegionPolicy?: boolean;

  // ── Domain 6: AI / ML Cost Management ────────────────────────────────────

  /** AI/ML model inference costs are tracked at the model or endpoint level. */
  hasAiCostVisibility?: boolean;

  /** Token usage and per-request cost are attributed to consuming teams. */
  hasTokenAttribution?: boolean;

  /** Model selection is evaluated on cost-per-quality trade-offs. */
  hasModelCostOptimization?: boolean;

  /** AI/ML cost budgets and alerts are in place. */
  hasAiCostAlerts?: boolean;
}

export interface FinOpsAssessmentRunOutput {
  /** The workspace assessed. */
  workspaceId: string;

  /** FinOps Framework 2026 schema version used. */
  assessmentVersion: string;

  /** ISO 8601 period start. */
  periodStart: string;

  /** ISO 8601 period end. */
  periodEnd: string;

  /**
   * Per-domain capability assessments — one record per domain.
   * Each record contains domain, domainName, maturityLevel, score,
   * findings[], and recommendations[].
   */
  capabilities: FinOpsCapabilityAssessment[];

  /**
   * Overall maturity level — modal level across all domains.
   * Tie-break: lower (less mature) level wins.
   */
  overallMaturityLevel: "crawl" | "walk" | "run";

  /**
   * Overall FinOps score 0–100.
   * Computed as the unweighted average of all domain scores.
   */
  overallScore: number;

  /**
   * Top 3 priority recommendations across all domains.
   * Ordered by domain score ascending (highest-impact domains first).
   */
  topRecommendations: string[];

  /** ISO 8601 timestamp when the assessment was computed. */
  computedAt: string;

  /** Scoring mode — always "deterministic" in Phase 9. */
  ingestMode: "deterministic";
}

// ---------------------------------------------------------------------------
// Input → AssessmentSignals mapper
// ---------------------------------------------------------------------------

function buildSignals(input: FinOpsAssessmentRunInput): AssessmentSignals {
  return {
    understand: {
      hasTaggingPolicy: input.hasTaggingPolicy,
      hasSharedCostAllocation: input.hasSharedCostAllocation,
      hasCostDashboard: input.hasCostDashboard,
      hasUnitEconomics: input.hasUnitEconomics,
      hasAnomalyDetection: input.hasAnomalyDetection,
    },
    quantify: {
      hasProductCostMapping: input.hasProductCostMapping,
      hasExecutiveReporting: input.hasExecutiveReporting,
      hasRoiTracking: input.hasRoiTracking,
      hasShowbackOrChargeback: input.hasShowbackOrChargeback,
    },
    optimize: {
      hasCommitmentCoverage: input.hasCommitmentCoverage,
      hasRightsizing: input.hasRightsizing,
      hasWasteRemediation: input.hasWasteRemediation,
      hasSpotUsage: input.hasSpotUsage,
      hasStorageLifecycle: input.hasStorageLifecycle,
    },
    managePractice: {
      hasFinOpsTeam: input.hasFinOpsTeam,
      hasBudgetProcess: input.hasBudgetProcess,
      hasKpiTracking: input.hasKpiTracking,
      hasEngineerVisibility: input.hasEngineerVisibility,
      hasMaturityReview: input.hasMaturityReview,
    },
    sustainability: {
      hasCarbonVisibility: input.hasCarbonVisibility,
      hasSustainabilityTargets: input.hasSustainabilityTargets,
      hasGreenRegionPolicy: input.hasGreenRegionPolicy,
    },
    aiMl: {
      hasAiCostVisibility: input.hasAiCostVisibility,
      hasTokenAttribution: input.hasTokenAttribution,
      hasModelCostOptimization: input.hasModelCostOptimization,
      hasAiCostAlerts: input.hasAiCostAlerts,
    },
  };
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const finOpsAssessmentRunTool: McpToolDescriptor<
  FinOpsAssessmentRunInput,
  FinOpsAssessmentRunOutput
> = {
  id: "finops.assessment.run",
  name: "FinOps Assessment Run",
  description:
    "Run a FinOps Framework 2026 maturity assessment for a workspace. " +
    "Accepts boolean capability signal flags across all six FinOps Framework domains " +
    "(understand-cloud-usage-cost, quantify-business-value, optimize-cloud-usage-cost, " +
    "manage-finops-practice, cloud-sustainability, ai-ml-cost-management) and returns " +
    "per-domain maturity levels (crawl/walk/run), scores (0–100), findings, " +
    "recommendations, and the top 3 cross-domain priority actions. " +
    "Overall maturity is the modal level across all six domains.",
  namespace: "finops",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["periodStart", "periodEnd"],
    properties: {
      workspaceId: {
        type: "string",
        description: "Workspace identifier. Defaults to 'default' if omitted.",
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of the assessment period (e.g. '2026-01-01').",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of the assessment period (e.g. '2026-02-01').",
      },
      // Domain 1
      hasTaggingPolicy: { type: "boolean", description: "Tagging policy is defined and enforced." },
      hasSharedCostAllocation: { type: "boolean", description: "Shared costs are allocated to teams." },
      hasCostDashboard: { type: "boolean", description: "Cost dashboard reviewed monthly." },
      hasUnitEconomics: { type: "boolean", description: "Unit economics metrics are tracked." },
      hasAnomalyDetection: { type: "boolean", description: "Anomaly detection alerts are active." },
      // Domain 2
      hasProductCostMapping: { type: "boolean", description: "Cloud spend mapped to product lines." },
      hasExecutiveReporting: { type: "boolean", description: "Unit cost trends reported to leadership quarterly." },
      hasRoiTracking: { type: "boolean", description: "ROI tracked for major cloud investments." },
      hasShowbackOrChargeback: { type: "boolean", description: "Showback or chargeback in place." },
      // Domain 3
      hasCommitmentCoverage: { type: "boolean", description: "RIs / savings plans / CUDs purchased and managed." },
      hasRightsizing: { type: "boolean", description: "Rightsizing recommendations actioned monthly." },
      hasWasteRemediation: { type: "boolean", description: "Idle resources identified and cleaned up regularly." },
      hasSpotUsage: { type: "boolean", description: "Spot / preemptible instances in use." },
      hasStorageLifecycle: { type: "boolean", description: "Storage lifecycle policies defined." },
      // Domain 4
      hasFinOpsTeam: { type: "boolean", description: "FinOps team or virtual function established." },
      hasBudgetProcess: { type: "boolean", description: "Cloud cost budgets reviewed monthly." },
      hasKpiTracking: { type: "boolean", description: "FinOps KPIs tracked and reported." },
      hasEngineerVisibility: { type: "boolean", description: "Engineers have self-serve cost visibility." },
      hasMaturityReview: { type: "boolean", description: "FinOps maturity review conducted annually." },
      // Domain 5
      hasCarbonVisibility: { type: "boolean", description: "Carbon emissions data available per workload." },
      hasSustainabilityTargets: { type: "boolean", description: "Sustainability targets set for cloud workloads." },
      hasGreenRegionPolicy: { type: "boolean", description: "Region selection considers carbon intensity." },
      // Domain 6
      hasAiCostVisibility: { type: "boolean", description: "AI/ML inference costs tracked per model." },
      hasTokenAttribution: { type: "boolean", description: "Token usage attributed to consuming teams." },
      hasModelCostOptimization: { type: "boolean", description: "Model selection evaluated on cost-per-quality." },
      hasAiCostAlerts: { type: "boolean", description: "AI/ML cost budgets and alerts active." },
    },
  },

  handler: async (envelope): Promise<McpToolResult<FinOpsAssessmentRunOutput>> => {
    const { input, context } = envelope;

    const workspaceId = input.workspaceId ?? context.workspaceId ?? "default";
    const signals = buildSignals(input);

    const assessment: FinOpsFrameworkAssessment = computeAssessment({
      workspaceId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      signals,
    });

    const output: FinOpsAssessmentRunOutput = {
      workspaceId: assessment.workspaceId,
      assessmentVersion: assessment.assessmentVersion,
      periodStart: assessment.periodStart,
      periodEnd: assessment.periodEnd,
      capabilities: assessment.capabilities,
      overallMaturityLevel: assessment.overallMaturityLevel,
      overallScore: assessment.overallScore,
      topRecommendations: assessment.topRecommendations,
      computedAt: assessment.computedAt,
      ingestMode: "deterministic",
    };

    return {
      output,
      toolId: finOpsAssessmentRunTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings: [
        "Assessment uses deterministic scoring from declared workspace signals. " +
        "Live telemetry ingestion (Phase 11) will auto-derive signals from actual provider data.",
      ],
      appliedIds: [
        "finops.assessment.engine.v2026.1",
        "finops.assessment.modal-maturity.tie-break-lower",
        `finops.assessment.maturity.${assessment.overallMaturityLevel}`,
      ],
    };
  },
};
