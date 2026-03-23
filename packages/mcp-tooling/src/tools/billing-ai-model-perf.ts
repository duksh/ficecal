// ─── billing.ai.model.perf — MCP tool ─────────────────────────────────────────
//
// AI model performance vs cost tradeoff analysis — compares latency, quality,
// throughput, and cost-efficiency metrics across AI models to support
// informed model selection decisions.
//
// Tool id:   billing.ai.model.perf
// Namespace: billing
// Stability: experimental

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PerfMetric = "latency" | "quality" | "throughput" | "cost-efficiency";

export interface ModelPerfRecord {
  provider: string;
  model: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  qualityScore: number;
  throughputTokensPerSec: number;
  costPer1KTokens: number;
  requestCount: number;
  costEfficiencyScore: number;
  currency: string;
  recommended: boolean;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingAiModelPerfInput {
  providers?: string;
  periodStart: string;
  periodEnd: string;
  metric?: PerfMetric;
  minRequestCount?: number;
}

export interface BillingAiModelPerfOutput {
  periodStart: string;
  periodEnd: string;
  metric: string;
  models: ModelPerfRecord[];
  recommendation: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface ModelFixture {
  provider: string;
  model: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  qualityScore: number;
  throughputTokensPerSec: number;
  costPer1KTokens: number;
  requestCount: number;
}

const MODEL_FIXTURES: ModelFixture[] = [
  {
    provider: "anthropic",
    model: "claude-3-7-sonnet-20250219",
    avgLatencyMs: 1820,
    p99LatencyMs: 4200,
    qualityScore: 92,
    throughputTokensPerSec: 3800,
    costPer1KTokens: 0.77,
    requestCount: 12400,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022",
    avgLatencyMs: 680,
    p99LatencyMs: 1400,
    qualityScore: 78,
    throughputTokensPerSec: 8200,
    costPer1KTokens: 0.08,
    requestCount: 18600,
  },
  {
    provider: "openai",
    model: "gpt-4o",
    avgLatencyMs: 1240,
    p99LatencyMs: 2800,
    qualityScore: 89,
    throughputTokensPerSec: 4500,
    costPer1KTokens: 1.23,
    requestCount: 9800,
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    avgLatencyMs: 520,
    p99LatencyMs: 1100,
    qualityScore: 74,
    throughputTokensPerSec: 9100,
    costPer1KTokens: 0.15,
    requestCount: 22400,
  },
  {
    provider: "google",
    model: "gemini-2.0-flash",
    avgLatencyMs: 410,
    p99LatencyMs: 900,
    qualityScore: 82,
    throughputTokensPerSec: 12000,
    costPer1KTokens: 0.04,
    requestCount: 28600,
  },
  {
    provider: "mistral",
    model: "mistral-large-2411",
    avgLatencyMs: 980,
    p99LatencyMs: 2200,
    qualityScore: 84,
    throughputTokensPerSec: 5200,
    costPer1KTokens: 0.18,
    requestCount: 4200,
  },
];

const KNOWN_PROVIDERS = [...new Set(MODEL_FIXTURES.map((f) => f.provider))];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCostEfficiencyScore(qualityScore: number, costPer1KTokens: number): number {
  if (costPer1KTokens === 0) return 0;
  return parseFloat(((qualityScore / costPer1KTokens) * 10).toFixed(2));
}

type SortKey = keyof Pick<
  ModelPerfRecord,
  "avgLatencyMs" | "qualityScore" | "throughputTokensPerSec" | "costEfficiencyScore"
>;

function getMetricSortKey(metric: PerfMetric): SortKey {
  switch (metric) {
    case "latency":
      return "avgLatencyMs";
    case "quality":
      return "qualityScore";
    case "throughput":
      return "throughputTokensPerSec";
    case "cost-efficiency":
      return "costEfficiencyScore";
  }
}

function isAscending(metric: PerfMetric): boolean {
  // Lower latency = better; everything else higher = better
  return metric === "latency";
}

function buildRecommendation(
  sortedModels: ModelPerfRecord[],
  metric: PerfMetric,
): string {
  if (sortedModels.length === 0) return "No models matched the filter criteria.";
  const top = sortedModels[0]!;
  const metricLabel: Record<PerfMetric, string> = {
    latency: "lowest latency",
    quality: "highest quality score",
    throughput: "highest throughput",
    "cost-efficiency": "best cost-efficiency",
  };
  return (
    `Top model by ${metricLabel[metric]}: ${top.provider}/${top.model}. ` +
    `Quality: ${top.qualityScore}/100, Cost: $${top.costPer1KTokens}/1K tokens, ` +
    `Latency: ${top.avgLatencyMs}ms avg, Efficiency score: ${top.costEfficiencyScore}.`
  );
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingAiModelPerfTool: McpToolDescriptor<
  BillingAiModelPerfInput,
  BillingAiModelPerfOutput
> = {
  id: "billing.ai.model.perf",
  name: "Billing AI Model Performance vs Cost",
  description:
    "Compares latency, quality, throughput, and cost-efficiency metrics across AI models " +
    "to support informed model selection decisions. Identifies top-2 recommended models " +
    "by the selected metric. Aligned with the FinOps Framework 2026 AI Technology category.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["periodStart", "periodEnd"],
    properties: {
      providers: {
        type: "string",
        description:
          "Comma-separated AI providers to include. Default: all.",
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of analysis period.",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of analysis period.",
      },
      metric: {
        type: "string",
        description:
          "Primary metric for ranking: 'latency' | 'quality' | 'throughput' | 'cost-efficiency'. Default: 'cost-efficiency'.",
        enum: ["latency", "quality", "throughput", "cost-efficiency"],
      },
      minRequestCount: {
        type: "number",
        description:
          "Minimum request count to include a model. Default: 100.",
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingAiModelPerfOutput>> => {
    const { input, context } = envelope;

    const metric: PerfMetric = input.metric ?? "cost-efficiency";
    const minRequestCount = input.minRequestCount ?? 100;

    const providers =
      !input.providers || input.providers.trim() === ""
        ? KNOWN_PROVIDERS
        : input.providers.split(",").map((p) => p.trim().toLowerCase());

    const warnings: string[] = [
      "Model performance data is deterministic (fixture-based). Live telemetry integration available in a future release.",
    ];

    // ── Build records ──────────────────────────────────────────────────────
    const filtered = MODEL_FIXTURES.filter(
      (f) => providers.includes(f.provider) && f.requestCount >= minRequestCount,
    );

    const sortKey = getMetricSortKey(metric);
    const ascending = isAscending(metric);

    const records: ModelPerfRecord[] = filtered.map((f) => ({
      provider: f.provider,
      model: f.model,
      avgLatencyMs: f.avgLatencyMs,
      p99LatencyMs: f.p99LatencyMs,
      qualityScore: f.qualityScore,
      throughputTokensPerSec: f.throughputTokensPerSec,
      costPer1KTokens: f.costPer1KTokens,
      requestCount: f.requestCount,
      costEfficiencyScore: computeCostEfficiencyScore(f.qualityScore, f.costPer1KTokens),
      currency: "USD",
      recommended: false, // filled below
    }));

    // Sort by metric
    records.sort((a, b) => {
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return ascending ? aVal - bVal : bVal - aVal;
    });

    // Mark top 2 as recommended
    records.forEach((r, i) => {
      r.recommended = i < 2;
    });

    const recommendation = buildRecommendation(records, metric);

    const output: BillingAiModelPerfOutput = {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      metric,
      models: records,
      recommendation,
      warnings,
    };

    return {
      output,
      toolId: billingAiModelPerfTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.ai.model.perf.focus-aligned",
        "billing.ai.model.perf.deterministic",
      ],
    };
  },
};
