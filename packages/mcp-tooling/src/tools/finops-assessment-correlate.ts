// ─── finops.assessment.correlate — MCP tool ───────────────────────────────────
//
// Correlates FinOps Framework 2026 maturity assessment findings with actual
// billing data across cloud and AI providers. Surfaces where capability gaps
// have the largest dollar impact, ranked by estimated ROI.
//
// Algorithm:
//   1. Compute FinOps capability assessment from workspace signals
//   2. Load billing records from registered providers for the period
//   3. Segment spend: AI providers (anthropic/openai/google/mistral/deepseek/alibaba)
//      vs cloud providers (aws/gcp/azure)
//   4. For each low-scoring domain, apply correlation rules to estimate waste
//      attributable to the capability gap
//   5. Rank correlatedRecommendations by roiScore = saving / effort (normalised)
//   6. Sum all estimatedWaste → totalAddressableWaste
//
// Correlation rules (Phase 10 deterministic):
//   • Domain 6 (AI/ML) + low hasModelCostOptimization → 20% AI spend is routeable
//   • Domain 6 (AI/ML) + low hasTokenAttribution      → 5% AI spend is unattributed
//   • Domain 6 (AI/ML) + low hasAiCostAlerts          → 15% of AI anomalies undetected
//   • Domain 1 (Understand) + low hasAnomalyDetection → 15% total spend at risk
//   • Domain 3 (Optimize) + low hasWasteRemediation   → 10% cloud spend is reclaimable
//   • Domain 3 (Optimize) + low hasRightsizing        → 8% cloud spend is overprovisioned
//   • Domain 2 (Business) + low hasShowbackOrChargeback → 0 financial accountability
//
// Tool id:   finops.assessment.correlate
// Namespace: finops
// Stability: beta
// Phase: 10A P3

import type { McpToolDescriptor, McpToolResult, McpToolEnvelope } from "../types.js";
import type { ComputeAssessmentInput } from "@ficecal/finops-assessment";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";
import { computeAssessment } from "@ficecal/finops-assessment";
import type { AssessmentSignals } from "@ficecal/finops-assessment";
import type { FinOpsAssessmentRunInput } from "./finops-assessment-run.js";

// ─── Registry (same shape as AnomalyBillingRegistry) ─────────────────────────

export interface CorrelationBillingRegistry {
  getAdapter(provider: string): {
    load(start: string, end: string): Promise<unknown>;
    ingestMode?: "deterministic" | "live";
  } | undefined;
  getFixture(provider: string): { version: string } | undefined;
}

let _billingRegistry: CorrelationBillingRegistry | null = null;

export function setCorrelationBillingRegistry(registry: CorrelationBillingRegistry): void {
  _billingRegistry = registry;
}

export function _resetCorrelationBillingRegistry(): void {
  _billingRegistry = null;
}

// ─── AI provider set ─────────────────────────────────────────────────────────

const AI_PROVIDER_IDS = new Set([
  "anthropic", "openai", "google", "mistral", "deepseek", "alibaba",
]);

const ALL_DEFAULT_PROVIDERS = [
  "anthropic", "openai", "google", "mistral", "deepseek", "alibaba",
  "aws", "gcp", "azure",
];

// ─── Input / Output ───────────────────────────────────────────────────────────

export type FinOpsAssessmentCorrelateInput = Pick<
  FinOpsAssessmentRunInput,
  | "workspaceId" | "periodStart" | "periodEnd"
  // Domain 1: Understand
  | "hasTaggingPolicy" | "hasSharedCostAllocation" | "hasCostDashboard"
  | "hasUnitEconomics" | "hasAnomalyDetection"
  // Domain 2: Business value
  | "hasProductCostMapping" | "hasExecutiveReporting" | "hasRoiTracking"
  | "hasShowbackOrChargeback"
  // Domain 3: Optimize
  | "hasCommitmentCoverage" | "hasRightsizing" | "hasWasteRemediation"
  | "hasSpotUsage" | "hasStorageLifecycle"
  // Domain 4: Practice
  | "hasFinOpsTeam" | "hasBudgetProcess" | "hasKpiTracking"
  | "hasEngineerVisibility" | "hasMaturityReview"
  // Domain 5: Sustainability
  | "hasCarbonVisibility" | "hasSustainabilityTargets" | "hasGreenRegionPolicy"
  // Domain 6: AI/ML
  | "hasAiCostVisibility" | "hasTokenAttribution"
  | "hasModelCostOptimization" | "hasAiCostAlerts"
> & {
  /**
   * Provider IDs to pull billing data from.
   * Defaults to all known providers if omitted.
   */
  providers?: string[];
};

export type ImplementationEffort = "low" | "medium" | "high";

export interface CorrelatedRecommendation {
  /** Stable recommendation id — e.g. "ai-model-routing-gap". */
  id: string;

  /** FinOps Framework domain id. */
  domain: string;

  /** FinOps Framework domain display name. */
  domainName: string;

  /** The capability flag that is missing (e.g. "hasModelCostOptimization"). */
  gapCapability: string;

  /**
   * Dollar estimate of waste attributable to this capability gap.
   * Formatted as "NNN.NNNNNNNNNN" (10 decimal places).
   */
  estimatedWaste: string;

  /**
   * Dollar estimate of potential saving if the gap is closed.
   * Typically equal to estimatedWaste (optimistic model).
   */
  estimatedSaving: string;

  /** Relative effort to close the gap. */
  implementationEffort: ImplementationEffort;

  /**
   * ROI score 0–100. Higher = close this gap first.
   * Computed as: (estimatedSavingUSD / effortMultiplier) normalised to 0–100.
   */
  roiScore: number;

  /** Human-readable recommendation. */
  recommendation: string;

  /** Provider IDs whose billing data surfaced this recommendation. */
  affectedProviders: string[];
}

export interface FinOpsAssessmentCorrelateOutput {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;

  /** Modal maturity level across all domains. */
  overallMaturityLevel: "crawl" | "walk" | "run";

  /** Unweighted average domain score 0–100. */
  overallScore: number;

  // ── Billing summary ────────────────────────────────────────────────────────

  /** Total spend across all providers for the period (USD, 10dp string). */
  totalBillingSpend: string;

  /** Spend on AI API providers (anthropic, openai, etc.) only. */
  aiProviderSpend: string;

  /** Spend on cloud infrastructure providers (aws, gcp, azure) only. */
  cloudProviderSpend: string;

  // ── Correlation results ────────────────────────────────────────────────────

  /**
   * Capability-gap recommendations ranked by roiScore DESC.
   * Empty when all capabilities are present or billing data is unavailable.
   */
  correlatedRecommendations: CorrelatedRecommendation[];

  /**
   * Sum of all estimatedWaste entries — total addressable dollar waste
   * attributable to identified FinOps capability gaps.
   */
  totalAddressableWaste: string;

  /**
   * Short label for the single highest-impact gap.
   * Empty string when no gaps found.
   */
  topAddressableGap: string;

  // ── Metadata ──────────────────────────────────────────────────────────────

  /** Providers whose billing data was loaded. */
  providersCovered: string[];

  /** Providers requested but not found in registry. */
  providersSkipped: string[];

  /**
   * "deterministic" — all adapters returned fixture data
   * "live"          — all adapters returned live data
   * "contextual"    — mixture of assessment signals + billing data
   */
  ingestMode: "deterministic" | "live" | "contextual";

  computedAt: string;
  correlationVersion: "1.0";
}

// ─── Effort multipliers ───────────────────────────────────────────────────────
//
// Used to normalize ROI: saving / effortMultiplier → raw score.
// Low effort = 1 (realised quickly), medium = 2, high = 4.

const EFFORT_MULTIPLIER: Record<ImplementationEffort, number> = {
  low:    1,
  medium: 2,
  high:   4,
};

// ─── Billing helpers ──────────────────────────────────────────────────────────

function extractRecords(raw: unknown): NormalizedCostRecord[] {
  if (Array.isArray(raw)) return raw as NormalizedCostRecord[];
  // BillingPeriodSummary shape (Phase 6/7 cloud adapters)
  const data = raw as {
    provider: string;
    lineItems: Array<{ service: string; cost: number; currency: string; startDate: string; endDate: string }>;
    billingPeriodStart: string;
    billingPeriodEnd: string;
  };
  return data.lineItems.map((li, idx) => ({
    recordId:           `${data.provider}:${li.service}:${idx}`,
    sourceSystem:       `ficecal-billing-${data.provider}`,
    provider:           data.provider,
    providerRole:       "direct-provider" as const,
    billingPeriodStart: data.billingPeriodStart,
    billingPeriodEnd:   data.billingPeriodEnd,
    chargePeriodStart:  li.startDate,
    chargePeriodEnd:    li.endDate,
    currency:           li.currency,
    amount:             li.cost.toFixed(10),
    amountType:         "actual" as const,
    serviceName:        li.service,
    dataCompleteness:   "partial" as const,
    ingestedAt:         new Date().toISOString(),
    schemaVersion:      "2.0.0",
  }));
}

function sumAmount(records: NormalizedCostRecord[]): number {
  return records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
}

// ─── Correlation rules ────────────────────────────────────────────────────────

interface CorrelationRule {
  id: string;
  domain: string;
  domainName: string;
  gapCapability: keyof FinOpsAssessmentCorrelateInput;
  /** Fraction of the relevant spend that is wasted when this gap exists. */
  wasteFraction: number;
  /** Which spend bucket this rule applies to: "ai", "cloud", or "total". */
  spendBucket: "ai" | "cloud" | "total";
  implementationEffort: ImplementationEffort;
  /** Which providers are relevant (empty = all). */
  relevantProviders: string[];
  buildRecommendation(
    estimatedSaving: number,
    affectedProviders: string[],
  ): string;
}

const CORRELATION_RULES: CorrelationRule[] = [
  {
    id:                   "ai-model-routing-gap",
    domain:               "ai-ml-cost-management",
    domainName:           "AI / ML Cost Management",
    gapCapability:        "hasModelCostOptimization",
    wasteFraction:        0.20,
    spendBucket:          "ai",
    implementationEffort: "medium",
    relevantProviders:    ["anthropic", "openai", "google", "mistral"],
    buildRecommendation:  (saving, providers) =>
      `No model-cost optimization detected. ${providers.join(", ")} usage shows ` +
      `~20% of AI spend ($${saving.toFixed(2)}) could be redirected to lower-cost ` +
      `models with equivalent quality. Implement billing.routing.optimize to surface ` +
      `top model-swap opportunities.`,
  },
  {
    id:                   "ai-token-attribution-gap",
    domain:               "ai-ml-cost-management",
    domainName:           "AI / ML Cost Management",
    gapCapability:        "hasTokenAttribution",
    wasteFraction:        0.05,
    spendBucket:          "ai",
    implementationEffort: "low",
    relevantProviders:    [],
    buildRecommendation:  (saving, providers) =>
      `Token usage is not attributed to teams or cost centres across ` +
      `${providers.join(", ")}. Unattributed spend ($${saving.toFixed(2)} estimated) ` +
      `prevents chargeback and creates accountability gaps. Instrument request headers ` +
      `with workspace or team identifiers.`,
  },
  {
    id:                   "ai-cost-alerts-gap",
    domain:               "ai-ml-cost-management",
    domainName:           "AI / ML Cost Management",
    gapCapability:        "hasAiCostAlerts",
    wasteFraction:        0.15,
    spendBucket:          "ai",
    implementationEffort: "low",
    relevantProviders:    [],
    buildRecommendation:  (saving, providers) =>
      `No AI cost alerts are configured. Undetected spend spikes across ` +
      `${providers.join(", ")} could account for up to $${saving.toFixed(2)} per period. ` +
      `Activate billing.anomaly.detect with thresholdPercent: 50 for early warning.`,
  },
  {
    id:                   "cloud-anomaly-detection-gap",
    domain:               "understand-cloud-usage-cost",
    domainName:           "Understand Cloud Usage & Cost",
    gapCapability:        "hasAnomalyDetection",
    wasteFraction:        0.15,
    spendBucket:          "total",
    implementationEffort: "low",
    relevantProviders:    [],
    buildRecommendation:  (saving, providers) =>
      `Anomaly detection is not active. Undetected billing spikes across ` +
      `${providers.join(", ")} could represent $${saving.toFixed(2)} in avoidable spend. ` +
      `Enable billing.anomaly.detect with your existing cost data.`,
  },
  {
    id:                   "cloud-waste-remediation-gap",
    domain:               "optimize-cloud-usage-cost",
    domainName:           "Optimize Cloud Usage & Cost",
    gapCapability:        "hasWasteRemediation",
    wasteFraction:        0.10,
    spendBucket:          "cloud",
    implementationEffort: "medium",
    relevantProviders:    ["aws", "gcp", "azure"],
    buildRecommendation:  (saving, providers) =>
      `No waste remediation process detected. Idle resources across ` +
      `${providers.join(", ")} are estimated to represent ~10% of cloud spend ` +
      `($${saving.toFixed(2)}). Implement automated rightsizing recommendations ` +
      `and scheduled idle-resource cleanup.`,
  },
  {
    id:                   "cloud-rightsizing-gap",
    domain:               "optimize-cloud-usage-cost",
    domainName:           "Optimize Cloud Usage & Cost",
    gapCapability:        "hasRightsizing",
    wasteFraction:        0.08,
    spendBucket:          "cloud",
    implementationEffort: "medium",
    relevantProviders:    ["aws", "gcp", "azure"],
    buildRecommendation:  (saving, providers) =>
      `Rightsizing recommendations are not actioned. Overprovisioned resources across ` +
      `${providers.join(", ")} estimated at ~8% of cloud spend ($${saving.toFixed(2)}). ` +
      `Review compute family upgrade paths and enable cost-optimisation advisors.`,
  },
  {
    id:                   "no-showback-chargeback-gap",
    domain:               "quantify-business-value",
    domainName:           "Quantify Business Value",
    gapCapability:        "hasShowbackOrChargeback",
    wasteFraction:        0.0,   // Not dollar-quantifiable — accountability gap
    spendBucket:          "total",
    implementationEffort: "high",
    relevantProviders:    [],
    buildRecommendation:  (saving, providers) =>
      `No showback or chargeback mechanism is in place. Teams consuming resources across ` +
      `${providers.join(", ")} have no financial accountability. Implement team cost ` +
      `allocation via billing.chargeback.allocate to drive ownership culture.`,
  },
];

// ─── ROI normaliser ───────────────────────────────────────────────────────────
//
// Maps raw score (saving / effortMultiplier) to 0–100.
// Uses a reference value of $10,000 per period = score 100 at low effort.

const ROI_REFERENCE = 10_000;

function computeRoiScore(estimatedSaving: number, effort: ImplementationEffort): number {
  const raw = estimatedSaving / EFFORT_MULTIPLIER[effort];
  const score = Math.min(100, Math.round((raw / ROI_REFERENCE) * 100));
  return Math.max(1, score); // floor at 1 so even $0 gaps get a rank token
}

// ─── ingestMode resolution ────────────────────────────────────────────────────

function resolveIngestMode(
  adapters: Array<"deterministic" | "live" | undefined>,
): "deterministic" | "live" | "contextual" {
  if (adapters.length === 0) return "contextual";
  const modes = new Set(adapters.filter(Boolean));
  if (modes.size === 1) {
    const only = [...modes][0]!;
    return only === "deterministic" ? "deterministic" : "live";
  }
  return "contextual";
}

// ─── Assessment signal builder ────────────────────────────────────────────────

function buildSignals(input: FinOpsAssessmentCorrelateInput): AssessmentSignals {
  return {
    understand: {
      hasTaggingPolicy:        input.hasTaggingPolicy        ?? false,
      hasSharedCostAllocation: input.hasSharedCostAllocation ?? false,
      hasCostDashboard:        input.hasCostDashboard        ?? false,
      hasUnitEconomics:        input.hasUnitEconomics        ?? false,
      hasAnomalyDetection:     input.hasAnomalyDetection     ?? false,
    },
    quantify: {
      hasProductCostMapping:   input.hasProductCostMapping   ?? false,
      hasExecutiveReporting:   input.hasExecutiveReporting   ?? false,
      hasRoiTracking:          input.hasRoiTracking          ?? false,
      hasShowbackOrChargeback: input.hasShowbackOrChargeback ?? false,
    },
    optimize: {
      hasCommitmentCoverage:   input.hasCommitmentCoverage   ?? false,
      hasRightsizing:          input.hasRightsizing          ?? false,
      hasWasteRemediation:     input.hasWasteRemediation     ?? false,
      hasSpotUsage:            input.hasSpotUsage            ?? false,
      hasStorageLifecycle:     input.hasStorageLifecycle     ?? false,
    },
    managePractice: {
      hasFinOpsTeam:           input.hasFinOpsTeam           ?? false,
      hasBudgetProcess:        input.hasBudgetProcess        ?? false,
      hasKpiTracking:          input.hasKpiTracking          ?? false,
      hasEngineerVisibility:   input.hasEngineerVisibility   ?? false,
      hasMaturityReview:       input.hasMaturityReview       ?? false,
    },
    sustainability: {
      hasCarbonVisibility:       input.hasCarbonVisibility       ?? false,
      hasSustainabilityTargets:  input.hasSustainabilityTargets  ?? false,
      hasGreenRegionPolicy:      input.hasGreenRegionPolicy       ?? false,
    },
    aiMl: {
      hasAiCostVisibility:       input.hasAiCostVisibility       ?? false,
      hasTokenAttribution:       input.hasTokenAttribution       ?? false,
      hasModelCostOptimization:  input.hasModelCostOptimization  ?? false,
      hasAiCostAlerts:           input.hasAiCostAlerts           ?? false,
    },
  };
}

// ─── Tool handler ─────────────────────────────────────────────────────────────

export const finOpsAssessmentCorrelateTool: McpToolDescriptor = {
  id:          "finops.assessment.correlate",
  name:        "FinOps Assessment Correlate",
  namespace:   "finops",
  stability:   "beta",
  description:
    "Correlates FinOps maturity assessment findings with actual billing data " +
    "across cloud and AI providers. Surfaces capability gaps ranked by dollar " +
    "impact and implementation ROI. Returns totalAddressableWaste and " +
    "correlatedRecommendations sorted by roiScore DESC.",

  inputSchema: {
    type:     "object",
    required: ["periodStart", "periodEnd"],
    properties: {
      workspaceId:              { type: "string",  description: "Workspace to assess. Defaults to 'default'." },
      periodStart:              { type: "string",  description: "Billing period start (YYYY-MM-DD)." },
      periodEnd:                { type: "string",  description: "Billing period end (YYYY-MM-DD)." },
      providers:                { type: "string",  description: "Provider IDs to include (comma-separated). Defaults to all." },
      hasTaggingPolicy:         { type: "boolean", description: "Cost allocation tags are defined and enforced." },
      hasSharedCostAllocation:  { type: "boolean", description: "Shared costs are allocated to teams." },
      hasCostDashboard:         { type: "boolean", description: "Cloud cost dashboard reviewed monthly." },
      hasUnitEconomics:         { type: "boolean", description: "Unit economics metrics are tracked." },
      hasAnomalyDetection:      { type: "boolean", description: "Anomaly detection alerts are active." },
      hasProductCostMapping:    { type: "boolean", description: "Cloud spend mapped to business products." },
      hasExecutiveReporting:    { type: "boolean", description: "Unit cost trends reported to leadership." },
      hasRoiTracking:           { type: "boolean", description: "ROI tracked for major cloud investments." },
      hasShowbackOrChargeback:  { type: "boolean", description: "Showback or chargeback is in place." },
      hasCommitmentCoverage:    { type: "boolean", description: "Reserved instances or savings plans purchased." },
      hasRightsizing:           { type: "boolean", description: "Rightsizing recommendations actioned monthly." },
      hasWasteRemediation:      { type: "boolean", description: "Idle resources identified and cleaned up." },
      hasSpotUsage:             { type: "boolean", description: "Spot or preemptible instances used." },
      hasStorageLifecycle:      { type: "boolean", description: "Storage lifecycle policies defined." },
      hasFinOpsTeam:            { type: "boolean", description: "FinOps team or function established." },
      hasBudgetProcess:         { type: "boolean", description: "Cloud cost budgets set and reviewed monthly." },
      hasKpiTracking:           { type: "boolean", description: "FinOps KPIs tracked and reported." },
      hasEngineerVisibility:    { type: "boolean", description: "Engineering teams have self-serve cost visibility." },
      hasMaturityReview:        { type: "boolean", description: "FinOps maturity review conducted annually." },
      hasCarbonVisibility:      { type: "boolean", description: "Carbon emissions data available per workload." },
      hasSustainabilityTargets: { type: "boolean", description: "Sustainability targets set for cloud workloads." },
      hasGreenRegionPolicy:     { type: "boolean", description: "Region selection considers carbon intensity." },
      hasAiCostVisibility:      { type: "boolean", description: "AI/ML inference costs tracked at model level." },
      hasTokenAttribution:      { type: "boolean", description: "Token usage attributed to consuming teams." },
      hasModelCostOptimization: { type: "boolean", description: "Model selection evaluated on cost/quality trade-offs." },
      hasAiCostAlerts:          { type: "boolean", description: "AI/ML cost budgets and alerts in place." },
    },
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (envelope: McpToolEnvelope<any>): Promise<McpToolResult<FinOpsAssessmentCorrelateOutput>> => {
    const input   = envelope.input   as FinOpsAssessmentCorrelateInput;
    const context = envelope.context;
    const {
      workspaceId = "default",
      periodStart,
      periodEnd,
    } = input;
    // providers may come as CSV string or array — normalise to string[]
    const rawProviders = (input as unknown as { providers?: string | string[] }).providers;
    const providers: string[] =
      Array.isArray(rawProviders)     ? rawProviders :
      typeof rawProviders === "string" ? rawProviders.split(",").map((p) => p.trim()).filter(Boolean) :
      ALL_DEFAULT_PROVIDERS;

    // ── 1. Run FinOps assessment ─────────────────────────────────────────────
    const signals = buildSignals(input);
    const assessmentInput: ComputeAssessmentInput = {
      workspaceId: workspaceId ?? "default",
      periodStart,
      periodEnd,
      signals,
    };
    const assessment = computeAssessment(assessmentInput);

    const overallScore = Math.round(
      assessment.capabilities.reduce((sum, c) => sum + c.score, 0) /
      Math.max(1, assessment.capabilities.length),
    );
    const maturityCounts = { crawl: 0, walk: 0, run: 0 };
    for (const cap of assessment.capabilities) maturityCounts[cap.maturityLevel]++;
    const overallMaturityLevel: "crawl" | "walk" | "run" =
      maturityCounts.crawl > 0 ? "crawl" :
      maturityCounts.walk  > 0 ? "walk"  : "run";

    // ── 2. Load billing data ─────────────────────────────────────────────────
    const ingestModes: Array<"deterministic" | "live" | undefined> = [];
    const providersCovered: string[] = [];
    const providersSkipped: string[] = [];
    const allRecords: NormalizedCostRecord[] = [];

    if (_billingRegistry !== null) {
      await Promise.all(
        providers.map(async (provider) => {
          const adapter = _billingRegistry!.getAdapter(provider);
          if (!adapter) {
            providersSkipped.push(provider);
            return;
          }
          try {
            const raw = await adapter.load(periodStart, periodEnd);
            allRecords.push(...extractRecords(raw));
            providersCovered.push(provider);
            ingestModes.push(adapter.ingestMode);
          } catch {
            providersSkipped.push(provider);
          }
        }),
      );
    }

    // ── 3. Segment spend ─────────────────────────────────────────────────────
    const aiRecords    = allRecords.filter((r) => AI_PROVIDER_IDS.has(r.provider));
    const cloudRecords = allRecords.filter((r) => !AI_PROVIDER_IDS.has(r.provider));

    const totalSpend = sumAmount(allRecords);
    const aiSpend    = sumAmount(aiRecords);
    const cloudSpend = sumAmount(cloudRecords);

    // ── 4. Apply correlation rules ───────────────────────────────────────────
    const correlatedRecommendations: CorrelatedRecommendation[] = [];

    for (const rule of CORRELATION_RULES) {
      // Check if the capability is missing (false / undefined)
      const capValue = input[rule.gapCapability] as boolean | undefined;
      if (capValue === true) continue;   // capability present — skip

      // Determine relevant providers for this rule
      const relevantProviders = rule.relevantProviders.length > 0
        ? rule.relevantProviders.filter((p) => providersCovered.includes(p))
        : providersCovered;
      if (relevantProviders.length === 0 && allRecords.length === 0) continue;

      // Compute spend base for this rule
      const spendBase =
        rule.spendBucket === "ai"    ? aiSpend    :
        rule.spendBucket === "cloud" ? cloudSpend : totalSpend;

      const wasteAmount   = spendBase * rule.wasteFraction;
      const savingAmount  = wasteAmount;
      const roiScore      = computeRoiScore(savingAmount, rule.implementationEffort);
      const displayProviders = relevantProviders.length > 0
        ? relevantProviders
        : providers.slice(0, 3);  // show first 3 as representative

      correlatedRecommendations.push({
        id:                   rule.id,
        domain:               rule.domain,
        domainName:           rule.domainName,
        gapCapability:        rule.gapCapability as string,
        estimatedWaste:       wasteAmount.toFixed(10),
        estimatedSaving:      savingAmount.toFixed(10),
        implementationEffort: rule.implementationEffort,
        roiScore,
        recommendation:       rule.buildRecommendation(savingAmount, displayProviders),
        affectedProviders:    displayProviders,
      });
    }

    // Rank by roiScore DESC, then by estimatedSaving DESC for ties
    correlatedRecommendations.sort((a, b) => {
      if (b.roiScore !== a.roiScore) return b.roiScore - a.roiScore;
      return parseFloat(b.estimatedSaving) - parseFloat(a.estimatedSaving);
    });

    // ── 5. Aggregate waste ───────────────────────────────────────────────────
    const totalWaste = correlatedRecommendations.reduce(
      (sum, r) => sum + parseFloat(r.estimatedWaste), 0,
    );
    const topGap = correlatedRecommendations[0]?.id ?? "";

    // ── 6. Assemble output ───────────────────────────────────────────────────
    const output: FinOpsAssessmentCorrelateOutput = {
      workspaceId,
      periodStart,
      periodEnd,
      overallMaturityLevel,
      overallScore,

      totalBillingSpend:  totalSpend.toFixed(10),
      aiProviderSpend:    aiSpend.toFixed(10),
      cloudProviderSpend: cloudSpend.toFixed(10),

      correlatedRecommendations,
      totalAddressableWaste: totalWaste.toFixed(10),
      topAddressableGap:     topGap,

      providersCovered,
      providersSkipped,
      ingestMode: resolveIngestMode(ingestModes),
      computedAt:         new Date().toISOString(),
      correlationVersion: "1.0",
    };

    const warnings: string[] = providersSkipped.length > 0
      ? [`Providers skipped (not in registry): ${providersSkipped.join(", ")}`]
      : [];

    return {
      output,
      toolId:     finOpsAssessmentCorrelateTool.id,
      executedAt: new Date().toISOString(),
      requestId:  context.requestId,
      warnings,
      appliedIds: [
        "finops.assessment.correlate.rules.v1",
        `finops.assessment.correlate.ingest.${output.ingestMode}`,
      ],
    };
  },
};
