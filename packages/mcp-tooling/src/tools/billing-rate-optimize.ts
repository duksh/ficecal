// ─── billing.rate.optimize — MCP tool ─────────────────────────────────────────
//
// Identifies on-demand → committed rate conversion opportunities.
//
// For each provider × service, compares on-demand unit prices against
// available commitment tiers (1yr/3yr RI, savings plans, CUDs).
// Ranks opportunities by estimated monthly saving DESC.
//
// Aligned with FinOps Framework 2026 "Rate Optimization" capability.
// Uses FOCUS 1.3 BilledCost / EffectiveCost semantics.
//
// Tool id: billing.rate.optimize
// Namespace: billing
// Stability: beta
// Phase: 11

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface BillingRateOptimizeInput {
  /**
   * Providers to analyse (comma-separated: "aws,gcp,azure").
   * Defaults to all cloud providers if omitted.
   */
  providers: string;
  /** ISO date "YYYY-MM-DD". */
  periodStart: string;
  periodEnd: string;
  /**
   * Minimum estimated monthly saving (USD) to surface a recommendation.
   * Default: 50.
   */
  minMonthlySavingUsd?: number;
  /**
   * If true, include 3-year commitment options in addition to 1-year.
   * Default: false (1-year only — more realistic for most teams).
   */
  include3YearOptions?: boolean;
}

export type CommitmentTier = "1yr-ri" | "3yr-ri" | "1yr-sp" | "3yr-sp" | "1yr-cud" | "3yr-cud";

export interface RateOpportunity {
  provider: string;
  /** FOCUS 1.3 ServiceName */
  serviceName: string;
  /** FOCUS 1.3 ResourceType (instance family / model / SKU) */
  resourceType: string;

  /** Current average on-demand unit rate (USD per unit). */
  onDemandRateUsd: number;
  /** Unit (e.g. "instance-hour", "vCPU-hour", "GB-month"). */
  rateUnit: string;

  /** Recommended commitment tier. */
  recommendedTier: CommitmentTier;
  /** Committed unit rate under recommended tier. */
  committedRateUsd: number;
  /** Discount percent vs on-demand. */
  discountPercent: number;

  /** Observed usage in the analysis period (rateUnit). */
  observedUsage: number;
  /** Estimated monthly saving (USD) if commitment is applied. */
  estimatedMonthlySavingUsd: number;
  /** Estimated annual saving (USD). */
  estimatedAnnualSavingUsd: number;

  /**
   * Confidence in the saving estimate.
   * high = stable usage; medium = moderate variance; low = high variance
   */
  confidence: "high" | "medium" | "low";

  recommendation: string;
}

export interface RateOptimizeSummary {
  totalOpportunities: number;
  totalEstimatedMonthlySavingUsd: number;
  totalEstimatedAnnualSavingUsd: number;
  providersCovered: string[];
}

export interface BillingRateOptimizeOutput {
  opportunities: RateOpportunity[];
  summary: RateOptimizeSummary;
  periodStart: string;
  periodEnd: string;
  minMonthlySavingUsd: number;
  ingestMode: "deterministic" | "live" | "mixed";
  computedAt: string;
  warnings: string[];
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface RateOptimizeAdapterRegistry {
  getRecords(
    provider: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<NormalizedCostRecord[]>;
  listProviders(): string[];
  getMode(): "deterministic" | "live" | "mixed";
}

// ─── Module-level registry ────────────────────────────────────────────────────

let _rateRegistry: RateOptimizeAdapterRegistry | null = null;

export function setRateOptimizeBillingRegistry(
  registry: RateOptimizeAdapterRegistry,
): void {
  _rateRegistry = registry;
}

export function _resetRateOptimizeBillingRegistry(): void {
  _rateRegistry = null;
}

// ─── Deterministic fixtures ───────────────────────────────────────────────────
//
// Rate optimization fixtures model real commitment discount structures.
// Sources:
//   AWS  — EC2 RI pricing (us-east-1, m5.xlarge)
//   GCP  — Compute Engine CUDs (us-central1, n2-standard-4)
//   Azure — VM RI pricing (East US, Standard_D4s_v3)

interface FixtureRateTier {
  tier: CommitmentTier;
  committedRateUsd: number;
}

interface FixtureServiceRate {
  provider: string;
  serviceName: string;
  resourceType: string;
  onDemandRateUsd: number;
  rateUnit: string;
  commitmentTiers: FixtureRateTier[];
  typicalMonthlyHours: number;
  usageVariance: "low" | "medium" | "high";
}

const RATE_FIXTURES: FixtureServiceRate[] = [
  // ─── AWS ────────────────────────────────────────────────────────────────────
  {
    provider: "aws",
    serviceName: "Amazon EC2",
    resourceType: "m5.xlarge",
    onDemandRateUsd: 0.192,
    rateUnit: "instance-hour",
    commitmentTiers: [
      { tier: "1yr-ri",  committedRateUsd: 0.117 },
      { tier: "3yr-ri",  committedRateUsd: 0.076 },
      { tier: "1yr-sp",  committedRateUsd: 0.124 },
      { tier: "3yr-sp",  committedRateUsd: 0.081 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "low",
  },
  {
    provider: "aws",
    serviceName: "Amazon RDS",
    resourceType: "db.r6g.large",
    onDemandRateUsd: 0.24,
    rateUnit: "instance-hour",
    commitmentTiers: [
      { tier: "1yr-ri",  committedRateUsd: 0.151 },
      { tier: "3yr-ri",  committedRateUsd: 0.101 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "low",
  },
  {
    provider: "aws",
    serviceName: "Amazon ElastiCache",
    resourceType: "cache.r7g.large",
    onDemandRateUsd: 0.166,
    rateUnit: "instance-hour",
    commitmentTiers: [
      { tier: "1yr-ri",  committedRateUsd: 0.102 },
      { tier: "3yr-ri",  committedRateUsd: 0.066 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "medium",
  },
  // ─── GCP ────────────────────────────────────────────────────────────────────
  {
    provider: "gcp",
    serviceName: "Compute Engine",
    resourceType: "n2-standard-4",
    onDemandRateUsd: 0.1900,
    rateUnit: "vCPU-hour",
    commitmentTiers: [
      { tier: "1yr-cud", committedRateUsd: 0.1330 },
      { tier: "3yr-cud", committedRateUsd: 0.0950 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "low",
  },
  {
    provider: "gcp",
    serviceName: "Cloud SQL",
    resourceType: "db-n1-standard-2",
    onDemandRateUsd: 0.1013,
    rateUnit: "instance-hour",
    commitmentTiers: [
      { tier: "1yr-cud", committedRateUsd: 0.0709 },
      { tier: "3yr-cud", committedRateUsd: 0.0507 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "medium",
  },
  // ─── Azure ──────────────────────────────────────────────────────────────────
  {
    provider: "azure",
    serviceName: "Virtual Machines",
    resourceType: "Standard_D4s_v3",
    onDemandRateUsd: 0.192,
    rateUnit: "instance-hour",
    commitmentTiers: [
      { tier: "1yr-ri",  committedRateUsd: 0.134 },
      { tier: "3yr-ri",  committedRateUsd: 0.096 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "low",
  },
  {
    provider: "azure",
    serviceName: "Azure SQL Database",
    resourceType: "GP_Gen5_4",
    onDemandRateUsd: 0.724,
    rateUnit: "vCore-hour",
    commitmentTiers: [
      { tier: "1yr-ri",  committedRateUsd: 0.507 },
      { tier: "3yr-ri",  committedRateUsd: 0.362 },
    ],
    typicalMonthlyHours: 730,
    usageVariance: "low",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function varianceToConfidence(v: "low" | "medium" | "high"): "high" | "medium" | "low" {
  if (v === "low")    return "high";
  if (v === "medium") return "medium";
  return "low";
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000));
}

function buildOpportunities(
  providers: string[],
  periodStart: string,
  periodEnd: string,
  minMonthlySavingUsd: number,
  include3Year: boolean,
): RateOpportunity[] {
  const days         = daysBetween(periodStart, periodEnd);
  const monthFraction = days / 30;
  const opportunities: RateOpportunity[] = [];

  for (const fixture of RATE_FIXTURES) {
    if (!providers.includes(fixture.provider)) continue;

    const observedUsage = monthFraction * fixture.typicalMonthlyHours;

    const eligibleTiers = fixture.commitmentTiers.filter((t) =>
      include3Year || !t.tier.startsWith("3yr"),
    );

    const bestTier = eligibleTiers.reduce<FixtureRateTier | null>(
      (best, t) => (best === null || t.committedRateUsd < best.committedRateUsd ? t : best),
      null,
    );
    if (!bestTier) continue;

    const savingPerUnit    = fixture.onDemandRateUsd - bestTier.committedRateUsd;
    const discountPercent  = Math.round((savingPerUnit / fixture.onDemandRateUsd) * 100 * 10) / 10;
    const monthlySaving    = savingPerUnit * fixture.typicalMonthlyHours;
    const annualSaving     = monthlySaving * 12;

    if (monthlySaving < minMonthlySavingUsd) continue;

    opportunities.push({
      provider:                   fixture.provider,
      serviceName:                fixture.serviceName,
      resourceType:               fixture.resourceType,
      onDemandRateUsd:            fixture.onDemandRateUsd,
      rateUnit:                   fixture.rateUnit,
      recommendedTier:            bestTier.tier,
      committedRateUsd:           bestTier.committedRateUsd,
      discountPercent,
      observedUsage:              Math.round(observedUsage * 100) / 100,
      estimatedMonthlySavingUsd:  Math.round(monthlySaving * 100) / 100,
      estimatedAnnualSavingUsd:   Math.round(annualSaving * 100) / 100,
      confidence:                 varianceToConfidence(fixture.usageVariance),
      recommendation:
        `Switch ${fixture.resourceType} from on-demand ($${fixture.onDemandRateUsd.toFixed(3)}/${fixture.rateUnit}) ` +
        `to ${bestTier.tier} ($${bestTier.committedRateUsd.toFixed(3)}/${fixture.rateUnit}). ` +
        `Estimated saving: $${Math.round(annualSaving).toLocaleString()}/year.`,
    });
  }

  return opportunities.sort(
    (a, b) => b.estimatedMonthlySavingUsd - a.estimatedMonthlySavingUsd,
  );
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const billingRateOptimizeTool: McpToolDescriptor<
  BillingRateOptimizeInput,
  BillingRateOptimizeOutput
> = {
  id: "billing.rate.optimize",
  name: "Identify Rate Optimization Opportunities",
  namespace: "billing",
  stability: "beta",
  description:
    "Identifies on-demand → committed rate conversion opportunities across " +
    "cloud providers. Compares current on-demand rates against available " +
    "commitment tiers (Reserved Instances, Savings Plans, Committed Use Discounts). " +
    "Ranks opportunities by estimated monthly saving. " +
    "Aligned with FinOps Framework 2026 Rate Optimization capability and FOCUS 1.3.",
  inputSchema: {
    type: "object",
    required: ["providers", "periodStart", "periodEnd"],
    properties: {
      providers: {
        type: "string",
        description: "Comma-separated providers to analyse (aws,gcp,azure). Empty or omitted = all.",
      },
      periodStart:          { type: "string", description: "ISO date YYYY-MM-DD" },
      periodEnd:            { type: "string", description: "ISO date YYYY-MM-DD" },
      minMonthlySavingUsd:  {
        type: "number",
        description: "Minimum monthly saving threshold (USD). Default: 50.",
      },
      include3YearOptions:  {
        type: "boolean",
        description: "Include 3-year commitment tiers. Default: false.",
      },
    },
  },
  async handler(envelope) {
    const { input, context } = envelope;

    if (!input.periodStart || !input.periodEnd) {
      throw new Error("Missing required fields: periodStart, periodEnd");
    }

    const minSaving    = input.minMonthlySavingUsd ?? 50;
    const include3Year = input.include3YearOptions ?? false;

    const knownProviders = ["aws", "gcp", "azure"];
    const providers =
      !input.providers || input.providers.trim() === ""
        ? knownProviders
        : input.providers.split(",").map((p) => p.trim());

    const warnings: string[] = [];
    let ingestMode: "deterministic" | "live" | "mixed" = "deterministic";

    if (_rateRegistry !== null) {
      ingestMode = _rateRegistry.getMode();
      warnings.push(
        "Live registry detected but billing.rate.optimize uses fixture rate tables. " +
        "Actual usage volumes will be reflected in a future release.",
      );
    }

    const opportunities = buildOpportunities(
      providers,
      input.periodStart,
      input.periodEnd,
      minSaving,
      include3Year,
    );

    const totalMonthly = opportunities.reduce(
      (sum, o) => sum + o.estimatedMonthlySavingUsd,
      0,
    );
    const totalAnnual = opportunities.reduce(
      (sum, o) => sum + o.estimatedAnnualSavingUsd,
      0,
    );

    const output: BillingRateOptimizeOutput = {
      opportunities,
      summary: {
        totalOpportunities:              opportunities.length,
        totalEstimatedMonthlySavingUsd:  Math.round(totalMonthly * 100) / 100,
        totalEstimatedAnnualSavingUsd:   Math.round(totalAnnual * 100) / 100,
        providersCovered:               [...new Set(opportunities.map((o) => o.provider))],
      },
      periodStart:         input.periodStart,
      periodEnd:           input.periodEnd,
      minMonthlySavingUsd: minSaving,
      ingestMode,
      computedAt:          new Date().toISOString(),
      warnings,
    };

    const result: McpToolResult<BillingRateOptimizeOutput> = {
      output,
      toolId:     billingRateOptimizeTool.id,
      executedAt: new Date().toISOString(),
      requestId:  context.requestId,
      warnings,
      appliedIds: ["billing.rate.optimize.commitment-tiers.v1"],
    };
    return result;
  },
};
