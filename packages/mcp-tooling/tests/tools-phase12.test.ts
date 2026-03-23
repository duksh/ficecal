// tests/tools-phase12.test.ts
// Unit tests for the 8 Phase 12 MCP tools:
//   billing.showback.report        (F1)
//   billing.tag.governance         (F2)
//   billing.budget.alert           (F3)
//   billing.attribution.pr         (F8/I5)
//   billing.ai.attribution         (A2)
//   billing.ai.cost.forecast       (A7)
//   billing.ai.model.perf          (A6)
//   billing.ai.ratelimit           (A4)

import { describe, it, expect, beforeEach } from "vitest";
import type { McpToolEnvelope, McpRequestContext } from "../src/types.js";
import {
  billingShowbackReportTool,
  _resetShowbackBillingRegistry,
  type BillingShowbackReportInput,
} from "../src/tools/billing-showback-report.js";
import {
  billingTagGovernanceTool,
  type BillingTagGovernanceInput,
} from "../src/tools/billing-tag-governance.js";
import {
  billingBudgetAlertTool,
  type BillingBudgetAlertInput,
} from "../src/tools/billing-budget-alert.js";
import {
  billingAttributionPrTool,
  type BillingAttributionPrInput,
} from "../src/tools/billing-attribution-pr.js";
import {
  billingAiAttributionTool,
  _resetAiAttributionRegistry,
  type BillingAiAttributionInput,
} from "../src/tools/billing-ai-attribution.js";
import {
  billingAiCostForecastTool,
  type BillingAiCostForecastInput,
} from "../src/tools/billing-ai-cost-forecast.js";
import {
  billingAiModelPerfTool,
  type BillingAiModelPerfInput,
} from "../src/tools/billing-ai-model-perf.js";
import {
  billingAiRatelimitTool,
  _resetAiRatelimitRegistry,
  type BillingAiRatelimitInput,
} from "../src/tools/billing-ai-ratelimit.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<McpRequestContext> = {}): McpRequestContext {
  return {
    requestId:        "test-req-p12",
    traceId:          "test-trace-p12",
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

// ─── billing.showback.report ──────────────────────────────────────────────────

describe("billing.showback.report", () => {
  beforeEach(() => {
    _resetShowbackBillingRegistry();
  });

  it("has correct tool id", () => {
    expect(billingShowbackReportTool.id).toBe("billing.showback.report");
    expect(billingShowbackReportTool.namespace).toBe("billing");
    expect(billingShowbackReportTool.stability).toBe("beta");
  });

  it("returns output with rows for aws provider", async () => {
    const input: BillingShowbackReportInput = {
      provider: "aws",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
    };
    const result = await billingShowbackReportTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.showback.report");
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.rows)).toBe(true);
  });

  it("output rows have allocatedCost > 0", async () => {
    const input: BillingShowbackReportInput = {
      provider: "aws",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
    };
    const result = await billingShowbackReportTool.handler(makeEnvelope(input));
    const rows = result.output.rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.allocatedCost).toBeGreaterThan(0);
  });

  it("output has totalCost field", async () => {
    const input: BillingShowbackReportInput = {
      provider: "gcp",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
    };
    const result = await billingShowbackReportTool.handler(makeEnvelope(input));
    expect(result.output.summary).toBeDefined();
    expect(typeof result.output.totalCost).toBe("number");
  });
});

// ─── billing.tag.governance ───────────────────────────────────────────────────

describe("billing.tag.governance", () => {
  it("has correct tool id", () => {
    expect(billingTagGovernanceTool.id).toBe("billing.tag.governance");
    expect(billingTagGovernanceTool.namespace).toBe("billing");
    expect(billingTagGovernanceTool.stability).toBe("beta");
  });

  it("returns violations for aws provider", async () => {
    const input: BillingTagGovernanceInput = {
      provider: "aws",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
    };
    const result = await billingTagGovernanceTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.tag.governance");
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.output).toBeDefined();
    expect(result.output.summary).toBeDefined();
  });

  it("output violations array exists", async () => {
    const input: BillingTagGovernanceInput = {
      provider: "aws",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
    };
    const result = await billingTagGovernanceTool.handler(makeEnvelope(input));
    expect(Array.isArray(result.output.violations)).toBe(true);
  });

  it("summary has complianceScore field", async () => {
    const input: BillingTagGovernanceInput = {
      provider: "azure",
      periodStart: "2026-01-01",
      periodEnd: "2026-02-01",
    };
    const result = await billingTagGovernanceTool.handler(makeEnvelope(input));
    expect(typeof result.output.summary.compliancePercent).toBe("number");
    expect(result.output.summary.compliancePercent).toBeGreaterThanOrEqual(0);
    expect(result.output.summary.compliancePercent).toBeLessThanOrEqual(100);
  });
});

// ─── billing.budget.alert ─────────────────────────────────────────────────────

describe("billing.budget.alert", () => {
  it("has correct tool id", () => {
    expect(billingBudgetAlertTool.id).toBe("billing.budget.alert");
    expect(billingBudgetAlertTool.namespace).toBe("billing");
    expect(billingBudgetAlertTool.stability).toBe("beta");
  });

  it("returns budget statuses", async () => {
    const budgets = [
      { provider: "aws",       monthlyBudgetUsd: 5000 },
      { provider: "anthropic", monthlyBudgetUsd: 2000 },
    ];
    const input: BillingBudgetAlertInput = {
      provider:    "aws",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
      budgets:     JSON.stringify(budgets),
    };
    const result = await billingBudgetAlertTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.budget.alert");
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.budgetStatuses)).toBe(true);
  });

  it("budget status has percentUsed field", async () => {
    const input: BillingBudgetAlertInput = {
      provider:    "aws",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
      budgets:     JSON.stringify([{ provider: "aws", monthlyBudgetUsd: 10000 }]),
    };
    const result = await billingBudgetAlertTool.handler(makeEnvelope(input));
    const statuses = result.output.budgetStatuses;
    expect(statuses.length).toBeGreaterThan(0);
    expect(typeof statuses[0]?.percentUsed).toBe("number");
  });
});

// ─── billing.attribution.pr ───────────────────────────────────────────────────

describe("billing.attribution.pr", () => {
  it("has correct tool id", () => {
    expect(billingAttributionPrTool.id).toBe("billing.attribution.pr");
    expect(billingAttributionPrTool.namespace).toBe("billing");
    expect(billingAttributionPrTool.stability).toBe("beta");
  });

  it("returns PR attribution output", async () => {
    const input: BillingAttributionPrInput = {
      prNumber:   "123",
      prTitle:    "Add GPU training job",
      repository: "ficecal/ficecal",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAttributionPrTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.attribution.pr");
    expect(result.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.output).toBeDefined();
  });

  it("output has costDrivers array", async () => {
    const input: BillingAttributionPrInput = {
      prNumber:   "456",
      prTitle:    "Add new billing pipeline",
      repository: "ficecal/ficecal",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAttributionPrTool.handler(makeEnvelope(input));
    expect(Array.isArray(result.output.costDrivers)).toBe(true);
  });

  it("output has riskLevel field", async () => {
    const input: BillingAttributionPrInput = {
      prNumber:   "789",
      prTitle:    "Optimize ML inference",
      repository: "ficecal/ficecal",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAttributionPrTool.handler(makeEnvelope(input));
    expect(["low", "medium", "high", "critical"]).toContain(result.output.riskLevel);
  });
});

// ─── billing.ai.attribution ───────────────────────────────────────────────────

describe("billing.ai.attribution", () => {
  beforeEach(() => {
    _resetAiAttributionRegistry();
  });

  it("has correct tool id", () => {
    expect(billingAiAttributionTool.id).toBe("billing.ai.attribution");
    expect(billingAiAttributionTool.namespace).toBe("billing");
    expect(billingAiAttributionTool.stability).toBe("beta");
  });

  it("returns attribution rows", async () => {
    const input: BillingAiAttributionInput = {
      providers:   "anthropic,openai",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAiAttributionTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.ai.attribution");
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.rows)).toBe(true);
    expect(result.output.rows.length).toBeGreaterThan(0);
  });

  it("rows have totalCost and provider fields", async () => {
    const input: BillingAiAttributionInput = {
      providers:   "anthropic",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAiAttributionTool.handler(makeEnvelope(input));
    const row = result.output.rows[0];
    expect(row).toBeDefined();
    if (row) {
      expect(typeof row.totalCost).toBe("number");
      expect(typeof row.provider).toBe("string");
    }
  });

  it("output has summary", async () => {
    const input: BillingAiAttributionInput = {
      providers:   "anthropic,openai,google",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAiAttributionTool.handler(makeEnvelope(input));
    expect(result.output.summary).toBeDefined();
  });
});

// ─── billing.ai.cost.forecast ─────────────────────────────────────────────────

describe("billing.ai.cost.forecast", () => {
  it("has correct tool id", () => {
    expect(billingAiCostForecastTool.id).toBe("billing.ai.cost.forecast");
    expect(billingAiCostForecastTool.namespace).toBe("billing");
    expect(billingAiCostForecastTool.stability).toBe("beta");
  });

  it("returns forecast data points", async () => {
    const input: BillingAiCostForecastInput = {
      providers:           "anthropic",
      periodStart:         "2026-01-01",
      periodEnd:           "2026-02-01",
      forecastHorizonDays: 30,
    };
    const result = await billingAiCostForecastTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.ai.cost.forecast");
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.dataPoints)).toBe(true);
  });

  it("data points have date and projectedCost fields", async () => {
    const input: BillingAiCostForecastInput = {
      providers:           "anthropic,openai",
      periodStart:         "2026-01-01",
      periodEnd:           "2026-02-01",
      forecastHorizonDays: 7,
    };
    const result = await billingAiCostForecastTool.handler(makeEnvelope(input));
    const dp = result.output.dataPoints[0];
    if (dp) {
      expect(typeof dp.date).toBe("string");
      expect(typeof dp.forecastCost).toBe("number");
    }
  });

  it("output has forecastTotalCost field", async () => {
    const input: BillingAiCostForecastInput = {
      providers:           "anthropic",
      periodStart:         "2026-01-01",
      periodEnd:           "2026-02-01",
      forecastHorizonDays: 14,
    };
    const result = await billingAiCostForecastTool.handler(makeEnvelope(input));
    expect(typeof result.output.forecastTotalCost).toBe("number");
  });
});

// ─── billing.ai.model.perf ────────────────────────────────────────────────────

describe("billing.ai.model.perf", () => {
  it("has correct tool id", () => {
    expect(billingAiModelPerfTool.id).toBe("billing.ai.model.perf");
    expect(billingAiModelPerfTool.namespace).toBe("billing");
    expect(billingAiModelPerfTool.stability).toBe("beta");
  });

  it("returns model perf records", async () => {
    const input: BillingAiModelPerfInput = {
      providers:   "anthropic,openai",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAiModelPerfTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.ai.model.perf");
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.models)).toBe(true);
    expect(result.output.models.length).toBeGreaterThan(0);
  });

  it("models have costEfficiencyScore", async () => {
    const input: BillingAiModelPerfInput = {
      providers:   "anthropic",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAiModelPerfTool.handler(makeEnvelope(input));
    const model = result.output.models[0];
    if (model) {
      expect(typeof model.costEfficiencyScore).toBe("number");
    }
  });

  it("output has recommendation field", async () => {
    const input: BillingAiModelPerfInput = {
      providers:   "anthropic,openai",
      periodStart: "2026-01-01",
      periodEnd:   "2026-02-01",
    };
    const result = await billingAiModelPerfTool.handler(makeEnvelope(input));
    expect(result.output.recommendation).toBeDefined();
  });
});

// ─── billing.ai.ratelimit ─────────────────────────────────────────────────────

describe("billing.ai.ratelimit", () => {
  beforeEach(() => {
    _resetAiRatelimitRegistry();
  });

  it("has correct tool id", () => {
    expect(billingAiRatelimitTool.id).toBe("billing.ai.ratelimit");
    expect(billingAiRatelimitTool.namespace).toBe("billing");
    expect(billingAiRatelimitTool.stability).toBe("beta");
  });

  it("returns provider rate limit statuses", async () => {
    const input: BillingAiRatelimitInput = {
      providers: "anthropic,openai",
      period:    "daily",
      budgets:   JSON.stringify([
        { provider: "anthropic", period: "daily", maxTotalTokens: 20_000_000 },
        { provider: "openai",    period: "daily", maxTotalTokens: 15_000_000 },
      ]),
    };
    const result = await billingAiRatelimitTool.handler(makeEnvelope(input));
    expect(result.toolId).toBe("billing.ai.ratelimit");
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.output.providers)).toBe(true);
    expect(result.output.providers.length).toBe(2);
  });

  it("providers have status field", async () => {
    const input: BillingAiRatelimitInput = {
      providers: "anthropic",
      period:    "daily",
      budgets:   JSON.stringify([
        { provider: "anthropic", period: "daily", maxTotalTokens: 50_000_000 },
      ]),
    };
    const result = await billingAiRatelimitTool.handler(makeEnvelope(input));
    const p = result.output.providers[0];
    expect(p).toBeDefined();
    if (p) {
      expect(["ok", "approaching", "throttled", "blocked"]).toContain(p.status);
    }
  });

  it("output has summary with counts", async () => {
    const input: BillingAiRatelimitInput = {
      period:  "daily",
      budgets: JSON.stringify([
        { provider: "anthropic", period: "daily", maxTotalTokens: 1_000 }, // very low → throttled
        { provider: "openai",    period: "daily", maxTotalTokens: 999_000_000 }, // very high → ok
      ]),
    };
    const result = await billingAiRatelimitTool.handler(makeEnvelope(input));
    expect(result.output.summary).toBeDefined();
    expect(typeof result.output.summary.totalProviders).toBe("number");
    expect(typeof result.output.summary.okCount).toBe("number");
    expect(result.output.summary.totalProviders).toBeGreaterThan(0);
  });

  it("very low budget triggers throttled/blocked status", async () => {
    const input: BillingAiRatelimitInput = {
      providers: "anthropic",
      period:    "daily",
      budgets:   JSON.stringify([
        { provider: "anthropic", period: "daily", maxTotalTokens: 100 }, // anthropic uses ~14M daily
      ]),
    };
    const result = await billingAiRatelimitTool.handler(makeEnvelope(input));
    const p = result.output.providers[0];
    if (p) {
      expect(["approaching", "throttled", "blocked"]).toContain(p.status);
    }
  });

  it("warnings include fixture notice when no live registry", async () => {
    const input: BillingAiRatelimitInput = {
      providers: "anthropic",
      period:    "daily",
      budgets:   JSON.stringify([]),
    };
    const result = await billingAiRatelimitTool.handler(makeEnvelope(input));
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("deterministic");
  });
});
