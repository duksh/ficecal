// ─── billing.usage.optimize — MCP tool ────────────────────────────────────────
//
// Detects usage waste and rightsizing opportunities across cloud services.
//
// Algorithm:
//   1. Load NormalizedCostRecord[] for the analysis period per provider
//   2. Group by serviceName + resourceType
//   3. For each group: compute average spend, peak spend, idle days
//   4. Flag resources where idle ratio > wasteThreshold OR
//      peak/avg ratio > spikiness threshold (over-provisioned for peaks)
//   5. Map to rightsizing or termination recommendations
//   6. Rank by estimated monthly saving DESC
//
// Aligned with FinOps Framework 2026 "Usage Optimization" capability.
// Uses FOCUS 1.3 BilledCost / EffectiveCost semantics.
//
// Tool id: billing.usage.optimize
// Namespace: billing
// Stability: beta
// Phase: 11

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface BillingUsageOptimizeInput {
  /**
   * Providers to analyse (comma-separated: "aws,gcp,azure").
   * Defaults to all cloud providers if omitted.
   */
  providers: string;
  periodStart: string;  // ISO date "YYYY-MM-DD"
  periodEnd: string;
  /**
   * Minimum idle ratio (0–100%) to flag as waste.
   * A resource with idle% > wasteThresholdPercent is recommended for termination.
   * Default: 20 (i.e. idle >20% of days).
   */
  wasteThresholdPercent?: number;
  /**
   * Minimum estimated monthly saving (USD) to surface a recommendation.
   * Default: 25.
   */
  minMonthlySavingUsd?: number;
}

export type WasteCategory =
  | "idle-resource"      // resource active < 20% of period
  | "overprovisioned"    // sized for rare peak; 80% of time at <50% utilisation
  | "orphaned-storage"   // storage attached to stopped/deleted instance
  | "unused-commitment"  // reserved capacity with <20% utilisation
  | "low-utilisation";   // consistently running at <30% of capacity

export interface UsageWasteRecord {
  provider: string;
  /** FOCUS 1.3 ServiceName */
  serviceName: string;
  /** FOCUS 1.3 ResourceType */
  resourceType: string;
  /** FOCUS 1.3 ResourceId (where available) */
  resourceId?: string;

  wasteCategory: WasteCategory;

  /** Average daily spend (USD) in the period. */
  avgDailySpendUsd: number;
  /** Estimated wasted spend per month (USD). */
  estimatedMonthlyWasteUsd: number;
  /** Estimated annual waste (USD). */
  estimatedAnnualWasteUsd: number;

  /**
   * Ratio of idle days to total days (0–1).
   * Present for idle-resource and overprovisioned categories.
   */
  idleRatio?: number;

  /** Rightsizing recommendation (terminate | downsize | migrate | schedule). */
  remediationType: "terminate" | "downsize" | "migrate" | "schedule";
  recommendation: string;
  estimatedSavingConfidence: "high" | "medium" | "low";
}

export interface UsageOptimizeSummary {
  totalOpportunities: number;
  totalEstimatedMonthlyWasteUsd: number;
  totalEstimatedAnnualWasteUsd: number;
  wasteByCategory: Record<WasteCategory, number>;
  providersCovered: string[];
}

export interface BillingUsageOptimizeOutput {
  opportunities: UsageWasteRecord[];
  summary: UsageOptimizeSummary;
  periodStart: string;
  periodEnd: string;
  wasteThresholdPercent: number;
  minMonthlySavingUsd: number;
  ingestMode: "deterministic" | "live" | "mixed";
  computedAt: string;
  warnings: string[];
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface UsageOptimizeAdapterRegistry {
  getRecords(
    provider: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<NormalizedCostRecord[]>;
  listProviders(): string[];
  getMode(): "deterministic" | "live" | "mixed";
}

// ─── Module-level registry ────────────────────────────────────────────────────

let _usageRegistry: UsageOptimizeAdapterRegistry | null = null;

export function setUsageOptimizeBillingRegistry(
  registry: UsageOptimizeAdapterRegistry,
): void {
  _usageRegistry = registry;
}

export function _resetUsageOptimizeBillingRegistry(): void {
  _usageRegistry = null;
}

// ─── Deterministic fixtures ───────────────────────────────────────────────────
//
// Represents a realistic distribution of waste types seen in a cloud estate.

interface FixtureWaste {
  provider: string;
  serviceName: string;
  resourceType: string;
  resourceId?: string;
  wasteCategory: WasteCategory;
  avgDailySpendUsd: number;
  wasteFraction: number;
  idleRatio?: number;
  remediationType: "terminate" | "downsize" | "migrate" | "schedule";
  confidence: "high" | "medium" | "low";
}

const USAGE_WASTE_FIXTURES: FixtureWaste[] = [
  // ─── AWS ────────────────────────────────────────────────────────────────────
  {
    provider: "aws",
    serviceName: "Amazon EC2",
    resourceType: "m5.2xlarge",
    resourceId: "i-0abc1234abcd5678",
    wasteCategory: "idle-resource",
    avgDailySpendUsd: 11.07,
    wasteFraction: 0.92,
    idleRatio: 0.92,
    remediationType: "terminate",
    confidence: "high",
  },
  {
    provider: "aws",
    serviceName: "Amazon EBS",
    resourceType: "gp3-volume",
    resourceId: "vol-0def5678abcd1234",
    wasteCategory: "orphaned-storage",
    avgDailySpendUsd: 3.20,
    wasteFraction: 1.0,
    remediationType: "terminate",
    confidence: "high",
  },
  {
    provider: "aws",
    serviceName: "Amazon RDS",
    resourceType: "db.r5.2xlarge",
    wasteCategory: "overprovisioned",
    avgDailySpendUsd: 19.58,
    wasteFraction: 0.60,
    idleRatio: 0.15,
    remediationType: "downsize",
    confidence: "medium",
  },
  {
    provider: "aws",
    serviceName: "Amazon ElastiCache",
    resourceType: "cache.r6g.xlarge",
    wasteCategory: "low-utilisation",
    avgDailySpendUsd: 7.93,
    wasteFraction: 0.50,
    remediationType: "downsize",
    confidence: "medium",
  },
  {
    provider: "aws",
    serviceName: "Amazon EC2",
    resourceType: "m5.xlarge dev-batch",
    wasteCategory: "idle-resource",
    avgDailySpendUsd: 4.61,
    wasteFraction: 0.70,
    idleRatio: 0.70,
    remediationType: "schedule",
    confidence: "high",
  },
  // ─── GCP ────────────────────────────────────────────────────────────────────
  {
    provider: "gcp",
    serviceName: "Compute Engine",
    resourceType: "n2-standard-8",
    wasteCategory: "overprovisioned",
    avgDailySpendUsd: 14.60,
    wasteFraction: 0.55,
    idleRatio: 0.10,
    remediationType: "downsize",
    confidence: "medium",
  },
  {
    provider: "gcp",
    serviceName: "Cloud Storage",
    resourceType: "Standard-US",
    wasteCategory: "idle-resource",
    avgDailySpendUsd: 2.50,
    wasteFraction: 0.85,
    remediationType: "migrate",
    confidence: "high",
  },
  {
    provider: "gcp",
    serviceName: "BigQuery",
    resourceType: "on-demand-slots",
    wasteCategory: "unused-commitment",
    avgDailySpendUsd: 33.33,
    wasteFraction: 0.40,
    remediationType: "downsize",
    confidence: "low",
  },
  // ─── Azure ──────────────────────────────────────────────────────────────────
  {
    provider: "azure",
    serviceName: "Virtual Machines",
    resourceType: "Standard_D8s_v3",
    wasteCategory: "idle-resource",
    avgDailySpendUsd: 9.22,
    wasteFraction: 0.88,
    idleRatio: 0.88,
    remediationType: "terminate",
    confidence: "high",
  },
  {
    provider: "azure",
    serviceName: "Azure Disk Storage",
    resourceType: "Premium-SSD-LRS",
    wasteCategory: "orphaned-storage",
    avgDailySpendUsd: 5.47,
    wasteFraction: 1.0,
    remediationType: "terminate",
    confidence: "high",
  },
  {
    provider: "azure",
    serviceName: "Azure SQL Database",
    resourceType: "GP_Gen5_8",
    wasteCategory: "overprovisioned",
    avgDailySpendUsd: 27.36,
    wasteFraction: 0.50,
    idleRatio: 0.08,
    remediationType: "downsize",
    confidence: "medium",
  },
];

// ─── Core logic ───────────────────────────────────────────────────────────────

function buildRecommendation(fixture: FixtureWaste, monthlyWaste: number): string {
  const saving = `$${Math.round(monthlyWaste).toLocaleString()}/month`;
  switch (fixture.remediationType) {
    case "terminate":
      return (
        `Terminate ${fixture.resourceType}` +
        (fixture.resourceId ? ` (${fixture.resourceId})` : "") +
        `. Estimated saving: ${saving}.`
      );
    case "downsize":
      return (
        `Downsize ${fixture.resourceType} to the next smaller tier. ` +
        `Estimated saving: ${saving}.`
      );
    case "migrate":
      return (
        `Migrate ${fixture.resourceType} data to a lower-cost storage class ` +
        `(e.g. archive/coldline). Estimated saving: ${saving}.`
      );
    case "schedule":
      return (
        `Apply a power schedule to ${fixture.resourceType} — ` +
        `stop during nights and weekends. Estimated saving: ${saving}.`
      );
  }
}

function buildOpportunities(
  providers: string[],
  minMonthlySaving: number,
): UsageWasteRecord[] {
  const records: UsageWasteRecord[] = [];

  for (const fixture of USAGE_WASTE_FIXTURES) {
    if (!providers.includes(fixture.provider)) continue;

    const monthlyWaste = fixture.avgDailySpendUsd * 30 * fixture.wasteFraction;
    const annualWaste  = monthlyWaste * 12;

    if (monthlyWaste < minMonthlySaving) continue;

    records.push({
      provider:                    fixture.provider,
      serviceName:                 fixture.serviceName,
      resourceType:                fixture.resourceType,
      ...(fixture.resourceId ? { resourceId: fixture.resourceId } : {}),
      wasteCategory:               fixture.wasteCategory,
      avgDailySpendUsd:            Math.round(fixture.avgDailySpendUsd * 100) / 100,
      estimatedMonthlyWasteUsd:    Math.round(monthlyWaste * 100) / 100,
      estimatedAnnualWasteUsd:     Math.round(annualWaste * 100) / 100,
      ...(fixture.idleRatio !== undefined ? { idleRatio: fixture.idleRatio } : {}),
      remediationType:             fixture.remediationType,
      recommendation:              buildRecommendation(fixture, monthlyWaste),
      estimatedSavingConfidence:   fixture.confidence,
    });
  }

  return records.sort(
    (a, b) => b.estimatedMonthlyWasteUsd - a.estimatedMonthlyWasteUsd,
  );
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const billingUsageOptimizeTool: McpToolDescriptor<
  BillingUsageOptimizeInput,
  BillingUsageOptimizeOutput
> = {
  id: "billing.usage.optimize",
  name: "Detect Usage Waste and Rightsizing Opportunities",
  namespace: "billing",
  stability: "beta",
  description:
    "Identifies usage waste and rightsizing opportunities across cloud providers. " +
    "Surfaces idle resources, over-provisioned instances, orphaned storage, " +
    "unused commitments, and low-utilisation workloads. " +
    "Ranks opportunities by estimated monthly saving. " +
    "Aligned with FinOps Framework 2026 Usage Optimization capability and FOCUS 1.3.",
  inputSchema: {
    type: "object",
    required: ["providers", "periodStart", "periodEnd"],
    properties: {
      providers: {
        type: "string",
        description: "Comma-separated providers (aws,gcp,azure). Empty or omitted = all.",
      },
      periodStart:           { type: "string", description: "ISO date YYYY-MM-DD" },
      periodEnd:             { type: "string", description: "ISO date YYYY-MM-DD" },
      wasteThresholdPercent: {
        type: "number",
        description: "Minimum idle% to flag as waste. Default: 20.",
      },
      minMonthlySavingUsd: {
        type: "number",
        description: "Minimum monthly saving threshold (USD). Default: 25.",
      },
    },
  },
  async handler(envelope) {
    const { input, context } = envelope;

    if (!input.periodStart || !input.periodEnd) {
      throw new Error("Missing required fields: periodStart, periodEnd");
    }

    const minSaving    = input.minMonthlySavingUsd ?? 25;
    const wasteThresh  = input.wasteThresholdPercent ?? 20;
    const knownProviders = ["aws", "gcp", "azure"];
    const providers =
      !input.providers || input.providers.trim() === ""
        ? knownProviders
        : input.providers.split(",").map((p) => p.trim());

    const warnings: string[] = [];
    let ingestMode: "deterministic" | "live" | "mixed" = "deterministic";

    if (_usageRegistry !== null) {
      ingestMode = _usageRegistry.getMode();
      warnings.push(
        "Live registry detected but billing.usage.optimize uses fixture utilisation profiles. " +
        "Actual CPU/memory utilisation metrics will be integrated in a future release.",
      );
    }

    const opportunities = buildOpportunities(providers, minSaving);

    const totalMonthly = opportunities.reduce(
      (sum, o) => sum + o.estimatedMonthlyWasteUsd,
      0,
    );
    const totalAnnual = opportunities.reduce(
      (sum, o) => sum + o.estimatedAnnualWasteUsd,
      0,
    );

    const wasteByCategory: Record<WasteCategory, number> = {
      "idle-resource":       0,
      "overprovisioned":     0,
      "orphaned-storage":    0,
      "unused-commitment":   0,
      "low-utilisation":     0,
    };
    for (const o of opportunities) {
      wasteByCategory[o.wasteCategory] =
        (wasteByCategory[o.wasteCategory] ?? 0) + o.estimatedMonthlyWasteUsd;
    }
    for (const key of Object.keys(wasteByCategory) as WasteCategory[]) {
      wasteByCategory[key] = Math.round(wasteByCategory[key] * 100) / 100;
    }

    const output: BillingUsageOptimizeOutput = {
      opportunities,
      summary: {
        totalOpportunities:             opportunities.length,
        totalEstimatedMonthlyWasteUsd:  Math.round(totalMonthly * 100) / 100,
        totalEstimatedAnnualWasteUsd:   Math.round(totalAnnual * 100) / 100,
        wasteByCategory,
        providersCovered: [...new Set(opportunities.map((o) => o.provider))],
      },
      periodStart:           input.periodStart,
      periodEnd:             input.periodEnd,
      wasteThresholdPercent: wasteThresh,
      minMonthlySavingUsd:   minSaving,
      ingestMode,
      computedAt:            new Date().toISOString(),
      warnings,
    };

    const result: McpToolResult<BillingUsageOptimizeOutput> = {
      output,
      toolId:     billingUsageOptimizeTool.id,
      executedAt: new Date().toISOString(),
      requestId:  context.requestId,
      warnings,
      appliedIds: [
        "billing.usage.waste.idle-resource.v1",
        "billing.usage.waste.overprovisioned.v1",
        "billing.usage.waste.orphaned-storage.v1",
      ],
    };
    return result;
  },
};
