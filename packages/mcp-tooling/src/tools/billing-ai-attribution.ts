// ─── billing.ai.attribution — MCP tool ────────────────────────────────────────
//
// AI model cost attribution — breaks down AI provider spend by model, team,
// feature, or user for a given period. Enables per-request cost transparency
// and chargeback for AI workloads.
//
// Tool id:   billing.ai.attribution
// Namespace: billing
// Stability: beta

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiAttributionRow {
  groupId: string;
  groupName: string;
  provider: string;
  model?: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  costPerKTokens: number;
  requestCount: number;
  currency: string;
  percentOfTotal: number;
}

export interface AiAttributionSummary {
  rowCount: number;
  topProvider: string;
  topModel: string;
  avgCostPerRequest: number;
  totalRequests: number;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingAiAttributionInput {
  providers?: string;
  periodStart: string;
  periodEnd: string;
  groupBy?: "model" | "team" | "feature" | "user";
  minCostUsd?: number;
}

export interface BillingAiAttributionOutput {
  periodStart: string;
  periodEnd: string;
  groupBy: string;
  totalCost: number;
  currency: string;
  rows: AiAttributionRow[];
  summary: AiAttributionSummary;
}

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

export interface AiAttributionRegistry {
  load(
    providers: string[],
    periodStart: string,
    periodEnd: string,
    groupBy: string,
  ): Promise<BillingAiAttributionOutput>;
}

let _aiAttributionRegistry: AiAttributionRegistry | null = null;

export function setAiAttributionRegistry(registry: AiAttributionRegistry): void {
  _aiAttributionRegistry = registry;
}

export function _resetAiAttributionRegistry(): void {
  _aiAttributionRegistry = null;
}

// ---------------------------------------------------------------------------
// Fixtures (groupBy=model)
// ---------------------------------------------------------------------------

interface ModelFixture {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
}

const MODEL_FIXTURES: ModelFixture[] = [
  {
    provider: "anthropic",
    model: "claude-3-7-sonnet-20250219",
    inputTokens: 2_400_000,
    outputTokens: 380_000,
    totalCost: 1840.50,
    requestCount: 12400,
  },
  {
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 1_800_000,
    outputTokens: 290_000,
    totalCost: 2210.30,
    requestCount: 9800,
  },
  {
    provider: "google",
    model: "gemini-2.0-flash",
    inputTokens: 5_200_000,
    outputTokens: 820_000,
    totalCost: 680.00,
    requestCount: 28600,
  },
  {
    provider: "mistral",
    model: "mistral-large",
    inputTokens: 890_000,
    outputTokens: 140_000,
    totalCost: 145.80,
    requestCount: 4200,
  },
];

// Alternative group fixtures (team/feature/user) derived from model data
interface GroupFixture {
  groupId: string;
  groupName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
}

const TEAM_FIXTURES: GroupFixture[] = [
  {
    groupId: "team-ml",
    groupName: "ML / AI Team",
    provider: "anthropic",
    inputTokens: 1_800_000,
    outputTokens: 280_000,
    totalCost: 1380.40,
    requestCount: 9200,
  },
  {
    groupId: "team-product",
    groupName: "Product Team",
    provider: "openai",
    inputTokens: 1_200_000,
    outputTokens: 190_000,
    totalCost: 1460.10,
    requestCount: 6400,
  },
  {
    groupId: "team-data",
    groupName: "Data Engineering",
    provider: "google",
    inputTokens: 3_400_000,
    outputTokens: 520_000,
    totalCost: 440.00,
    requestCount: 18200,
  },
  {
    groupId: "team-backend",
    groupName: "Backend Team",
    provider: "mistral",
    inputTokens: 890_000,
    outputTokens: 140_000,
    totalCost: 596.10,
    requestCount: 7200,
  },
];

const FEATURE_FIXTURES: GroupFixture[] = [
  {
    groupId: "feature-chat",
    groupName: "Chat Completion",
    provider: "anthropic",
    inputTokens: 2_800_000,
    outputTokens: 420_000,
    totalCost: 2140.00,
    requestCount: 14200,
  },
  {
    groupId: "feature-summarize",
    groupName: "Summarization",
    provider: "openai",
    inputTokens: 1_600_000,
    outputTokens: 240_000,
    totalCost: 1960.00,
    requestCount: 8800,
  },
  {
    groupId: "feature-classify",
    groupName: "Classification",
    provider: "google",
    inputTokens: 3_200_000,
    outputTokens: 480_000,
    totalCost: 380.60,
    requestCount: 22400,
  },
];

const USER_FIXTURES: GroupFixture[] = [
  {
    groupId: "user-alice",
    groupName: "alice@example.com",
    provider: "anthropic",
    inputTokens: 980_000,
    outputTokens: 148_000,
    totalCost: 740.20,
    requestCount: 4200,
  },
  {
    groupId: "user-bob",
    groupName: "bob@example.com",
    provider: "openai",
    inputTokens: 720_000,
    outputTokens: 112_000,
    totalCost: 880.60,
    requestCount: 3600,
  },
  {
    groupId: "user-carol",
    groupName: "carol@example.com",
    provider: "google",
    inputTokens: 2_100_000,
    outputTokens: 340_000,
    totalCost: 275.00,
    requestCount: 11200,
  },
  {
    groupId: "user-dave",
    groupName: "dave@example.com",
    provider: "mistral",
    inputTokens: 480_000,
    outputTokens: 78_000,
    totalCost: 80.80,
    requestCount: 2400,
  },
];

const KNOWN_PROVIDERS = ["anthropic", "openai", "google", "mistral"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterByProviders(items: { provider: string }[], providers: string[]): typeof items {
  if (providers.length === 0) return items;
  return items.filter((item) => providers.includes(item.provider));
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingAiAttributionTool: McpToolDescriptor<
  BillingAiAttributionInput,
  BillingAiAttributionOutput
> = {
  id: "billing.ai.attribution",
  name: "Billing AI Cost Attribution",
  description:
    "Breaks down AI provider spend by model, team, feature, or user for a given period. " +
    "Enables per-request cost transparency and chargeback for AI workloads. " +
    "Supports anthropic, openai, google, and mistral providers.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["periodStart", "periodEnd"],
    properties: {
      providers: {
        type: "string",
        description:
          "Comma-separated AI providers to include. Default: all (anthropic,openai,google,mistral).",
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of billing period.",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of billing period.",
      },
      groupBy: {
        type: "string",
        description: "Attribution dimension. Default: 'model'.",
        enum: ["model", "team", "feature", "user"],
      },
      minCostUsd: {
        type: "number",
        description: "Minimum cost threshold (USD) to include a row. Default: 0.",
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingAiAttributionOutput>> => {
    const { input, context } = envelope;

    const groupBy = input.groupBy ?? "model";
    const minCostUsd = input.minCostUsd ?? 0;
    const providers =
      !input.providers || input.providers.trim() === ""
        ? KNOWN_PROVIDERS
        : input.providers.split(",").map((p) => p.trim().toLowerCase());

    // ── Live adapter path ──────────────────────────────────────────────────
    if (_aiAttributionRegistry !== null) {
      const output = await _aiAttributionRegistry.load(
        providers,
        input.periodStart,
        input.periodEnd,
        groupBy,
      );
      return buildResult(output, context.requestId);
    }

    // ── Build rows from fixtures ───────────────────────────────────────────
    let rawRows: AiAttributionRow[];

    if (groupBy === "model") {
      const filtered = filterByProviders(MODEL_FIXTURES, providers) as ModelFixture[];
      rawRows = filtered.map((f) => {
        const totalTokens = f.inputTokens + f.outputTokens;
        const costPerKTokens =
          totalTokens > 0
            ? parseFloat(((f.totalCost / totalTokens) * 1000).toFixed(4))
            : 0;
        return {
          groupId: `${f.provider}/${f.model}`,
          groupName: `${f.provider} / ${f.model}`,
          provider: f.provider,
          model: f.model,
          totalTokens,
          inputTokens: f.inputTokens,
          outputTokens: f.outputTokens,
          totalCost: f.totalCost,
          costPerKTokens,
          requestCount: f.requestCount,
          currency: "USD",
          percentOfTotal: 0, // filled below
        };
      });
    } else {
      const fixtures: GroupFixture[] =
        groupBy === "team"
          ? TEAM_FIXTURES
          : groupBy === "feature"
          ? FEATURE_FIXTURES
          : USER_FIXTURES;

      const filtered = filterByProviders(fixtures, providers) as GroupFixture[];
      rawRows = filtered.map((f) => {
        const totalTokens = f.inputTokens + f.outputTokens;
        const costPerKTokens =
          totalTokens > 0
            ? parseFloat(((f.totalCost / totalTokens) * 1000).toFixed(4))
            : 0;
        return {
          groupId: f.groupId,
          groupName: f.groupName,
          provider: f.provider,
          totalTokens,
          inputTokens: f.inputTokens,
          outputTokens: f.outputTokens,
          totalCost: f.totalCost,
          costPerKTokens,
          requestCount: f.requestCount,
          currency: "USD",
          percentOfTotal: 0,
        };
      });
    }

    // ── Apply minCostUsd filter ────────────────────────────────────────────
    rawRows = rawRows.filter((r) => r.totalCost >= minCostUsd);

    // ── Compute totals and percents ────────────────────────────────────────
    const totalCost = parseFloat(
      rawRows.reduce((s, r) => s + r.totalCost, 0).toFixed(2),
    );
    const totalRequests = rawRows.reduce((s, r) => s + r.requestCount, 0);

    const rows = rawRows.map((r) => ({
      ...r,
      percentOfTotal:
        totalCost > 0
          ? parseFloat(((r.totalCost / totalCost) * 100).toFixed(2))
          : 0,
    }));

    // ── Summary ───────────────────────────────────────────────────────────
    const topRow = [...rows].sort((a, b) => b.totalCost - a.totalCost)[0];
    const avgCostPerRequest =
      totalRequests > 0
        ? parseFloat((totalCost / totalRequests).toFixed(6))
        : 0;

    const summary: AiAttributionSummary = {
      rowCount: rows.length,
      topProvider: topRow?.provider ?? "",
      topModel: topRow?.model ?? topRow?.groupName ?? "",
      avgCostPerRequest,
      totalRequests,
    };

    const output: BillingAiAttributionOutput = {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      groupBy,
      totalCost,
      currency: "USD",
      rows,
      summary,
    };

    return buildResult(output, context.requestId);
  },
};

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function buildResult(
  output: BillingAiAttributionOutput,
  requestId: string,
): McpToolResult<BillingAiAttributionOutput> {
  return {
    output,
    toolId: billingAiAttributionTool.id,
    executedAt: new Date().toISOString(),
    requestId,
    warnings: [
      "AI attribution data is deterministic (fixture-based). Live ingestion available in a future release.",
    ],
    appliedIds: [
      "billing.ai.attribution.focus-aligned",
      "billing.ai.attribution.deterministic",
    ],
  };
}
