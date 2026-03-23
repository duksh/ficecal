// tests/tools-phase11.test.ts
// Unit tests for the 4 Phase 11 MCP tools:
//   sustainability.carbon.estimate
//   billing.rate.optimize
//   billing.usage.optimize
//   billing.ai.quota

import { describe, it, expect, beforeEach } from "vitest";
import type { McpToolEnvelope, McpRequestContext } from "../src/types.js";
import {
  sustainabilityCarbonEstimateTool,
  type SustainabilityCarbonEstimateInput,
} from "../src/tools/sustainability-carbon-estimate.js";
import {
  billingRateOptimizeTool,
  _resetRateOptimizeBillingRegistry,
  type BillingRateOptimizeInput,
} from "../src/tools/billing-rate-optimize.js";
import {
  billingUsageOptimizeTool,
  _resetUsageOptimizeBillingRegistry,
  type BillingUsageOptimizeInput,
} from "../src/tools/billing-usage-optimize.js";
import {
  billingAiQuotaTool,
  _resetAiQuotaBillingRegistry,
  type BillingAiQuotaInput,
  type BillingAiQuotaOutput,
} from "../src/tools/billing-ai-quota.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<McpRequestContext> = {}): McpRequestContext {
  return {
    requestId:        "test-req-001",
    traceId:          "test-trace-001",
    mode:             "operator",
    workspaceId:      "ws-test",
    actor:            "human",
    timeRange:        { start: "2026-01-01", end: "2026-01-31", tz: "UTC" },
    contractVersions: { mcp: "1.0", tool: "1.0", fixture: "1.0" },
    featureFlags:     [],
    ...overrides,
  };
}

function makeEnvelope<T>(input: T): McpToolEnvelope<T> {
  return { context: makeContext(), input };
}

// ─── sustainability.carbon.estimate ──────────────────────────────────────────

describe("sustainability.carbon.estimate", () => {
  it("has correct tool id and namespace", () => {
    expect(sustainabilityCarbonEstimateTool.id).toBe("sustainability.carbon.estimate");
    expect(sustainabilityCarbonEstimateTool.namespace).toBe("sustainability");
  });

  it("returns carbon estimate for aws/us-east-1/inference", async () => {
    const input: SustainabilityCarbonEstimateInput = {
      provider:     "aws",
      regionCode:   "us-east-1",
      workloadType: "inference",
      quantity:     100,
      computeUnit:  "gpu-hour",
      periodStart:  "2026-01-01",
      periodEnd:    "2026-01-31",
    };
    const result = await sustainabilityCarbonEstimateTool.handler(makeEnvelope(input));
    expect(result.output.provider).toBe("aws");
    expect(result.output.workloadType).toBe("inference");
    expect(parseFloat(result.output.carbonKgCo2e)).toBeGreaterThan(0);
    expect(parseFloat(result.output.energyKwh)).toBeGreaterThan(0);
    expect(result.output.computedAt).toBeDefined();
    expect(result.toolId).toBe("sustainability.carbon.estimate");
    expect(result.requestId).toBe("test-req-001");
  });

  it("includes lower-carbon alternatives when requested", async () => {
    const input: SustainabilityCarbonEstimateInput = {
      provider:            "gcp",
      regionCode:          "us-central1",
      workloadType:        "training",
      quantity:            10,
      computeUnit:         "gpu-hour",
      periodStart:         "2026-01-01",
      periodEnd:           "2026-01-31",
      includeAlternatives: true,
    };
    const result = await sustainabilityCarbonEstimateTool.handler(makeEnvelope(input));
    // alternatives may or may not exist depending on catalog; output must be an array
    if (result.output.alternatives !== undefined) {
      expect(Array.isArray(result.output.alternatives)).toBe(true);
      for (const alt of result.output.alternatives) {
        expect(alt.carbonReductionPercent).toBeGreaterThan(0);
      }
    }
  });

  it("applies user intensity override", async () => {
    const input: SustainabilityCarbonEstimateInput = {
      provider:          "aws",
      regionCode:        "us-east-1",
      workloadType:      "embedding",
      quantity:          1,
      computeUnit:       "gpu-hour",
      periodStart:       "2026-01-01",
      periodEnd:         "2026-01-31",
      intensityOverride: 100, // very low intensity for test
    };
    const result = await sustainabilityCarbonEstimateTool.handler(makeEnvelope(input));
    expect(result.output.intensityGCo2ePerKwh).toBe(100);
    expect(result.output.intensitySource).toBe("user-override");
    expect(result.output.warnings.some((w) => w.includes("override"))).toBe(true);
  });

  it("formulasApplied contains sustainability.carbon.estimate.v1", async () => {
    const input: SustainabilityCarbonEstimateInput = {
      provider:     "azure",
      regionCode:   "eastus",
      workloadType: "storage",
      quantity:     500,
      computeUnit:  "cpu-hour",
      periodStart:  "2026-01-01",
      periodEnd:    "2026-01-31",
    };
    const result = await sustainabilityCarbonEstimateTool.handler(makeEnvelope(input));
    expect(result.appliedIds).toContain("sustainability.carbon.estimate.v1");
  });

  it("equivalentCarKm is a positive decimal string", async () => {
    const input: SustainabilityCarbonEstimateInput = {
      provider:     "aws",
      regionCode:   "eu-west-1",
      workloadType: "inference",
      quantity:     10,
      computeUnit:  "gpu-hour",
      periodStart:  "2026-01-01",
      periodEnd:    "2026-01-31",
    };
    const result = await sustainabilityCarbonEstimateTool.handler(makeEnvelope(input));
    expect(parseFloat(result.output.equivalentCarKm)).toBeGreaterThan(0);
  });

  it("warns about world-average fallback for unknown region", async () => {
    const input: SustainabilityCarbonEstimateInput = {
      provider:     "aws",
      regionCode:   "ap-invented-99",
      workloadType: "training",
      quantity:     5,
      computeUnit:  "gpu-hour",
      periodStart:  "2026-01-01",
      periodEnd:    "2026-01-31",
    };
    const result = await sustainabilityCarbonEstimateTool.handler(makeEnvelope(input));
    expect(result.output.warnings.some((w) => w.includes("world average"))).toBe(true);
    expect(result.output.intensityGCo2ePerKwh).toBe(475);
  });
});

// ─── billing.rate.optimize ────────────────────────────────────────────────────

describe("billing.rate.optimize", () => {
  beforeEach(() => { _resetRateOptimizeBillingRegistry(); });

  it("has correct tool id and namespace", () => {
    expect(billingRateOptimizeTool.id).toBe("billing.rate.optimize");
    expect(billingRateOptimizeTool.namespace).toBe("billing");
  });

  it("returns opportunities for aws", async () => {
    const input: BillingRateOptimizeInput = {
      providers:   "aws",
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
    };
    const result = await billingRateOptimizeTool.handler(makeEnvelope(input));
    expect(result.output.opportunities.length).toBeGreaterThan(0);
    for (const opp of result.output.opportunities) {
      expect(opp.provider).toBe("aws");
      expect(opp.estimatedMonthlySavingUsd).toBeGreaterThan(0);
    }
  });

  it("opportunities are sorted by monthly saving DESC", async () => {
    const input: BillingRateOptimizeInput = {
      providers:   "aws,gcp,azure",
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
    };
    const result = await billingRateOptimizeTool.handler(makeEnvelope(input));
    const savings = result.output.opportunities.map((o) => o.estimatedMonthlySavingUsd);
    for (let i = 1; i < savings.length; i++) {
      expect(savings[i - 1]).toBeGreaterThanOrEqual(savings[i]!);
    }
  });

  it("respects minMonthlySavingUsd filter", async () => {
    const input: BillingRateOptimizeInput = {
      providers:            "aws",
      periodStart:          "2026-01-01",
      periodEnd:            "2026-01-31",
      minMonthlySavingUsd:  10_000, // very high threshold — should return nothing
    };
    const result = await billingRateOptimizeTool.handler(makeEnvelope(input));
    expect(result.output.opportunities).toHaveLength(0);
  });

  it("summary totals are consistent with individual opportunities", async () => {
    const input: BillingRateOptimizeInput = {
      providers:   "aws,gcp",
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
    };
    const result = await billingRateOptimizeTool.handler(makeEnvelope(input));
    const sumMonthly = result.output.opportunities.reduce(
      (s, o) => s + o.estimatedMonthlySavingUsd,
      0,
    );
    expect(Math.abs(result.output.summary.totalEstimatedMonthlySavingUsd - sumMonthly)).toBeLessThan(0.01);
  });

  it("includes 3-year tiers when requested", async () => {
    const with3yr = await billingRateOptimizeTool.handler(makeEnvelope({
      providers: "aws", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      include3YearOptions: true,
    } as BillingRateOptimizeInput));
    const without3yr = await billingRateOptimizeTool.handler(makeEnvelope({
      providers: "aws", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      include3YearOptions: false,
    } as BillingRateOptimizeInput));
    // 3-year options give bigger discounts so savings should be >= without3yr
    expect(with3yr.output.summary.totalEstimatedMonthlySavingUsd)
      .toBeGreaterThanOrEqual(without3yr.output.summary.totalEstimatedMonthlySavingUsd);
  });

  it("ingestMode is deterministic with no registry", async () => {
    const result = await billingRateOptimizeTool.handler(makeEnvelope({
      providers: "aws", periodStart: "2026-01-01", periodEnd: "2026-01-31",
    } as BillingRateOptimizeInput));
    expect(result.output.ingestMode).toBe("deterministic");
  });
});

// ─── billing.usage.optimize ───────────────────────────────────────────────────

describe("billing.usage.optimize", () => {
  beforeEach(() => { _resetUsageOptimizeBillingRegistry(); });

  it("has correct tool id and namespace", () => {
    expect(billingUsageOptimizeTool.id).toBe("billing.usage.optimize");
    expect(billingUsageOptimizeTool.namespace).toBe("billing");
  });

  it("returns waste records for all providers", async () => {
    const input: BillingUsageOptimizeInput = {
      providers:   "aws,gcp,azure",
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
    };
    const result = await billingUsageOptimizeTool.handler(makeEnvelope(input));
    expect(result.output.opportunities.length).toBeGreaterThan(0);
    expect(result.output.summary.providersCovered.length).toBeGreaterThan(0);
  });

  it("opportunities are sorted by monthly waste DESC", async () => {
    const input: BillingUsageOptimizeInput = {
      providers: "aws,gcp,azure", periodStart: "2026-01-01", periodEnd: "2026-01-31",
    };
    const result = await billingUsageOptimizeTool.handler(makeEnvelope(input));
    const wastes = result.output.opportunities.map((o) => o.estimatedMonthlyWasteUsd);
    for (let i = 1; i < wastes.length; i++) {
      expect(wastes[i - 1]).toBeGreaterThanOrEqual(wastes[i]!);
    }
  });

  it("wasteByCategory sums equal totalEstimatedMonthlyWasteUsd (within rounding)", async () => {
    const result = await billingUsageOptimizeTool.handler(makeEnvelope({
      providers: "aws,gcp,azure", periodStart: "2026-01-01", periodEnd: "2026-01-31",
    } as BillingUsageOptimizeInput));
    const catSum = Object.values(result.output.summary.wasteByCategory).reduce(
      (a, b) => a + b, 0,
    );
    expect(Math.abs(catSum - result.output.summary.totalEstimatedMonthlyWasteUsd))
      .toBeLessThan(1);
  });

  it("respects minMonthlySavingUsd filter", async () => {
    const result = await billingUsageOptimizeTool.handler(makeEnvelope({
      providers: "aws", periodStart: "2026-01-01", periodEnd: "2026-01-31",
      minMonthlySavingUsd: 50_000,
    } as BillingUsageOptimizeInput));
    expect(result.output.opportunities).toHaveLength(0);
  });

  it("every opportunity has a non-empty recommendation", async () => {
    const result = await billingUsageOptimizeTool.handler(makeEnvelope({
      providers: "aws,gcp,azure", periodStart: "2026-01-01", periodEnd: "2026-01-31",
    } as BillingUsageOptimizeInput));
    for (const o of result.output.opportunities) {
      expect(o.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("appliedIds contains waste detection formula IDs", async () => {
    const result = await billingUsageOptimizeTool.handler(makeEnvelope({
      providers: "aws", periodStart: "2026-01-01", periodEnd: "2026-01-31",
    } as BillingUsageOptimizeInput));
    expect(result.appliedIds.some((id) => id.includes("waste"))).toBe(true);
  });
});

// ─── billing.ai.quota ────────────────────────────────────────────────────────

describe("billing.ai.quota", () => {
  beforeEach(() => { _resetAiQuotaBillingRegistry(); });

  it("has correct tool id and namespace", () => {
    expect(billingAiQuotaTool.id).toBe("billing.ai.quota");
    expect(billingAiQuotaTool.namespace).toBe("billing");
  });

  it("returns quota statuses for budgeted providers", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      quotas: [
        { provider: "anthropic", monthlyBudgetUsd: 2_000 },
        { provider: "openai",    monthlyBudgetUsd: 3_000 },
      ],
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    expect(out.quotaStatuses.length).toBeGreaterThan(0);
    const anthropicStatus = out.quotaStatuses.find((s) => s.provider === "anthropic");
    expect(anthropicStatus).toBeDefined();
    expect(anthropicStatus!.monthlyBudgetUsd).toBe(2_000);
  });

  it("detects exceeded providers", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      quotas: [
        // anthropic fixture spend is 1840.50 — budget of 1000 means exceeded
        { provider: "anthropic", monthlyBudgetUsd: 1_000 },
      ],
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    const anthStatus = out.quotaStatuses.find((s) => s.provider === "anthropic");
    expect(anthStatus!.quotaStatus).toBe("exceeded");
    expect(out.summary.providersExceeded).toContain("anthropic");
    expect(out.summary.overallStatus).toBe("critical");
  });

  it("marks providers as approaching when spend ≥ alertThreshold × budget", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      // anthropic fixture spend is 1840.50; budget 2100 → 87.6% → approaching at 80%
      quotas: [{ provider: "anthropic", monthlyBudgetUsd: 2_100, alertThreshold: 0.80 }],
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    const status = out.quotaStatuses.find((s) => s.provider === "anthropic");
    expect(status!.quotaStatus).toBe("approaching");
    expect(out.summary.providersApproaching).toContain("anthropic");
  });

  it("marks providers without quotas as unbudgeted", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      providers:   "google,mistral",
      quotas:      [], // no quotas defined
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    expect(out.summary.providersUnbudgeted).toContain("google");
    expect(out.summary.providersUnbudgeted).toContain("mistral");
  });

  it("accepts quotas as JSON string", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      providers:   "openai",
      quotas:      '[{"provider":"openai","monthlyBudgetUsd":5000}]',
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    const status = out.quotaStatuses.find((s) => s.provider === "openai");
    expect(status!.monthlyBudgetUsd).toBe(5_000);
  });

  it("overallStatus is healthy when all within budget", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      providers:   "deepseek,alibaba",
      // deepseek: $28.40, alibaba: $12.00 — both well within $500 budget
      quotas: [
        { provider: "deepseek", monthlyBudgetUsd: 500 },
        { provider: "alibaba",  monthlyBudgetUsd: 500 },
      ],
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    expect(out.summary.overallStatus).toBe("healthy");
  });

  it("requestId is threaded through from context", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      quotas:      [],
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    expect(result.requestId).toBe("test-req-001");
  });

  it("workspaceId from input is passed through to output", async () => {
    const input: BillingAiQuotaInput = {
      workspaceId: "ws-production-eu",
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      quotas:      [{ provider: "anthropic", monthlyBudgetUsd: 5_000 }],
    };
    const result = await billingAiQuotaTool.handler(makeEnvelope(input));
    const out = result.output as BillingAiQuotaOutput;
    expect(out.workspaceId).toBe("ws-production-eu");
  });

  it("throws for invalid JSON quotas string", async () => {
    const input: BillingAiQuotaInput = {
      periodStart: "2026-01-01",
      periodEnd:   "2026-01-31",
      quotas:      "this is not json",
    };
    await expect(billingAiQuotaTool.handler(makeEnvelope(input))).rejects.toThrow(
      "Invalid quotas format",
    );
  });
});
