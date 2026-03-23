// ─── sustainability.carbon.estimate — MCP tool ────────────────────────────────
//
// Estimates operational carbon emissions for a cloud workload using regional
// carbon intensity data (gCO2e/kWh) and workload power profiles.
//
// FOCUS 1.3 / FinOps Framework 2026 Sustainability capability.
//
// Formula:
//   energyKwh = quantity × avgWatts × pue / 1000
//   carbonKgCo2e = energyKwh × intensityGCo2ePerKwh / 1000
//
// Tool id: sustainability.carbon.estimate
// Namespace: sustainability
// Stability: beta
// Phase: 11

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import {
  estimateCarbon,
  REGION_CARBON_CATALOG,
} from "@ficecal/carbon-economics";
import type { WorkloadType, CarbonEstimateInput } from "@ficecal/carbon-economics";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface SustainabilityCarbonEstimateInput {
  /** Cloud provider (aws, gcp, azure, …). */
  provider: string;
  /** Cloud region code (e.g. "us-east-1", "europe-west1"). */
  regionCode: string;
  /**
   * Workload type — determines power profile.
   * One of: inference | training | fine-tuning | embedding | storage | networking
   */
  workloadType: WorkloadType;
  /** Number of compute units consumed. */
  quantity: number;
  /** Compute unit (e.g. "gpu-hour", "cpu-hour", "token-1m"). */
  computeUnit: string;
  /** ISO date "YYYY-MM-DD" — start of billing period. */
  periodStart: string;
  /** ISO date "YYYY-MM-DD" — end of billing period. */
  periodEnd: string;
  /**
   * Optional intensity override in gCO2e/kWh.
   * Use this when you have more precise regional data than the bundled catalog.
   */
  intensityOverride?: number;
  /**
   * If true, include a list of lower-carbon alternatives for the same provider.
   * Each alternative shows the percentage carbon reduction achievable by
   * switching region.
   */
  includeAlternatives?: boolean;
}

export interface LowCarbonAlternative {
  regionCode: string;
  regionName: string;
  intensityGCo2ePerKwh: number;
  estimatedCarbonKgCo2e: string;
  /** Percentage carbon reduction vs current region. */
  carbonReductionPercent: number;
  renewableCommitment: boolean;
}

export interface SustainabilityCarbonEstimateOutput {
  provider: string;
  regionCode: string;
  regionName: string;
  workloadType: WorkloadType;
  quantity: number;
  computeUnit: string;
  periodStart: string;
  periodEnd: string;

  /** Energy consumed in kWh (decimal-safe string, 10dp). */
  energyKwh: string;
  /** Carbon emitted in kg CO2e (decimal-safe string, 10dp). */
  carbonKgCo2e: string;
  /** Carbon emitted in metric tonnes CO2e (decimal-safe string, 10dp). */
  carbonTonnesCo2e: string;

  /** Carbon intensity applied (gCO2e/kWh). */
  intensityGCo2ePerKwh: number;
  pueMultiplier: number;
  renewableCommitment: boolean;

  /** Rough equivalence: equivalent km driven by average car (120g CO2/km). */
  equivalentCarKm: string;

  /** Source of intensity data. */
  intensitySource: string;

  /**
   * Suggested lower-carbon alternatives for the same provider.
   * Present only when includeAlternatives=true.
   */
  alternatives?: LowCarbonAlternative[];

  formulasApplied: string[];
  computedAt: string;
  warnings: string[];
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const sustainabilityCarbonEstimateTool: McpToolDescriptor<
  SustainabilityCarbonEstimateInput,
  SustainabilityCarbonEstimateOutput
> = {
  id: "sustainability.carbon.estimate",
  name: "Estimate Cloud Workload Carbon Emissions",
  namespace: "sustainability",
  stability: "beta",
  description:
    "Estimates operational CO2e emissions for a cloud workload using " +
    "regional carbon intensity data (gCO2e/kWh) and workload power profiles. " +
    "Supports all major cloud providers and regions. " +
    "Optionally surfaces lower-carbon region alternatives for the same provider. " +
    "Aligned with FinOps Framework 2026 Sustainability capability and FOCUS 1.3.",
  inputSchema: {
    type: "object",
    required: ["provider", "regionCode", "workloadType", "quantity", "computeUnit", "periodStart", "periodEnd"],
    properties: {
      provider:           { type: "string", description: "Cloud provider (aws | gcp | azure | …)" },
      regionCode:         { type: "string", description: "Cloud region code (e.g. us-east-1)" },
      workloadType:       {
        type: "string",
        enum: ["inference", "training", "fine-tuning", "embedding", "storage", "networking"],
        description: "Workload type — determines the power consumption profile",
      },
      quantity:           { type: "number", description: "Number of compute units consumed" },
      computeUnit:        { type: "string", description: "Compute unit (gpu-hour | cpu-hour | token-1m)" },
      periodStart:        { type: "string", description: "ISO date YYYY-MM-DD — period start" },
      periodEnd:          { type: "string", description: "ISO date YYYY-MM-DD — period end" },
      intensityOverride:  { type: "number", description: "Optional gCO2e/kWh override; skips catalog lookup" },
      includeAlternatives: { type: "boolean", description: "Include lower-carbon region alternatives for the provider" },
    },
  },
  async handler(envelope) {
    const { input, context } = envelope;

    // ── Validate required fields ──────────────────────────────────────────────
    const missing: string[] = [];
    if (!input.provider)    missing.push("provider");
    if (!input.regionCode)  missing.push("regionCode");
    if (!input.workloadType) missing.push("workloadType");
    if (input.quantity === undefined || input.quantity === null) missing.push("quantity");
    if (!input.computeUnit) missing.push("computeUnit");
    if (!input.periodStart) missing.push("periodStart");
    if (!input.periodEnd)   missing.push("periodEnd");
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }

    // ── Build CarbonEstimateInput (exactOptionalPropertyTypes-safe) ───────────
    const estimateInput: CarbonEstimateInput = {
      provider:     input.provider,
      regionCode:   input.regionCode,
      workloadType: input.workloadType,
      quantity:     input.quantity,
      computeUnit:  input.computeUnit,
      periodStart:  input.periodStart,
      periodEnd:    input.periodEnd,
      ...(input.intensityOverride !== undefined
        ? { intensityOverride: input.intensityOverride }
        : {}),
    };

    const result = estimateCarbon(estimateInput);

    // ── Build alternatives list ───────────────────────────────────────────────
    let alternatives: LowCarbonAlternative[] | undefined;
    if (input.includeAlternatives) {
      const sameProviderRegions = REGION_CARBON_CATALOG
        .filter(
          (r) =>
            r.provider === input.provider &&
            r.regionCode !== input.regionCode &&
            r.intensityGCo2ePerKwh < result.intensityGCo2ePerKwh,
        )
        .sort((a, b) => a.intensityGCo2ePerKwh - b.intensityGCo2ePerKwh)
        .slice(0, 5);

      alternatives = sameProviderRegions.map((alt) => {
        const altResult = estimateCarbon({
          ...estimateInput,
          regionCode: alt.regionCode,
        });
        const current   = parseFloat(result.carbonKgCo2e);
        const altCarbon = parseFloat(altResult.carbonKgCo2e);
        const reductionPct =
          current > 0 ? Math.round(((current - altCarbon) / current) * 100) : 0;

        return {
          regionCode:              alt.regionCode,
          regionName:              alt.regionName,
          intensityGCo2ePerKwh:   alt.intensityGCo2ePerKwh,
          estimatedCarbonKgCo2e:  altResult.carbonKgCo2e,
          carbonReductionPercent: reductionPct,
          renewableCommitment:    alt.renewableCommitment,
        };
      });
    }

    const output: SustainabilityCarbonEstimateOutput = {
      provider:              result.provider,
      regionCode:            result.regionCode,
      regionName:            result.regionName,
      workloadType:          result.workloadType,
      quantity:              input.quantity,
      computeUnit:           input.computeUnit,
      periodStart:           input.periodStart,
      periodEnd:             input.periodEnd,
      energyKwh:             result.energyKwh,
      carbonKgCo2e:          result.carbonKgCo2e,
      carbonTonnesCo2e:      result.carbonTonnesCo2e,
      intensityGCo2ePerKwh:  result.intensityGCo2ePerKwh,
      pueMultiplier:         result.pueMultiplier,
      renewableCommitment:   result.renewableCommitment,
      equivalentCarKm:       result.equivalentCarKm,
      intensitySource:       result.intensitySource,
      ...(alternatives !== undefined ? { alternatives } : {}),
      formulasApplied:       result.formulasApplied,
      computedAt:            result.computedAt,
      warnings:              result.warnings,
    };

    const toolResult: McpToolResult<SustainabilityCarbonEstimateOutput> = {
      output,
      toolId:      sustainabilityCarbonEstimateTool.id,
      executedAt:  new Date().toISOString(),
      requestId:   context.requestId,
      warnings:    result.warnings,
      appliedIds:  result.formulasApplied,
    };
    return toolResult;
  },
};
