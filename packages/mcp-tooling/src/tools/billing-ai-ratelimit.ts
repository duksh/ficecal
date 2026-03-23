// ─── billing.ai.ratelimit — MCP tool ──────────────────────────────────────────
//
// AI token budget enforcement and rate-limit tracking.
// Reports current token consumption against defined budgets, flags providers
// nearing or exceeding their rate limits, and recommends throttling actions.
//
// Tool id:   billing.ai.ratelimit
// Namespace: billing
// Stability: beta
//
// FinOps gap A4 — AI token budget enforcement / rate limits.
// Complements billing.ai.quota (spend budgets) with token-level rate limits.

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RateLimitStatus = "ok" | "approaching" | "throttled" | "blocked";

export type TokenBudgetPeriod = "hourly" | "daily" | "monthly";

export interface TokenBudget {
  /** Provider identifier: anthropic, openai, google, mistral, etc. */
  provider: string;
  /** Model identifier (optional — if omitted, applies to all models). */
  model?: string;
  /** Period over which the limit applies. */
  period: TokenBudgetPeriod;
  /** Maximum input tokens allowed per period. */
  maxInputTokens?: number;
  /** Maximum output tokens allowed per period. */
  maxOutputTokens?: number;
  /** Maximum total tokens (input + output) per period. */
  maxTotalTokens?: number;
  /** Maximum requests per period. */
  maxRequests?: number;
}

export interface RateLimitViolation {
  /** Which limit was violated. */
  limitType: "input_tokens" | "output_tokens" | "total_tokens" | "requests";
  /** Budget limit that was crossed. */
  budgetLimit: number;
  /** Actual consumption. */
  actualConsumption: number;
  /** Percent of budget consumed. */
  percentUsed: number;
  /** Recommended throttle action. */
  action: "warn" | "soft-throttle" | "hard-block";
}

export interface ProviderRateLimitStatus {
  provider: string;
  model?: string;
  period: TokenBudgetPeriod;
  status: RateLimitStatus;
  /** Actual token usage in period. */
  inputTokensUsed: number;
  outputTokensUsed: number;
  totalTokensUsed: number;
  requestsUsed: number;
  /** Configured limits (null if no budget set for this dimension). */
  inputTokensLimit: number | null;
  outputTokensLimit: number | null;
  totalTokensLimit: number | null;
  requestsLimit: number | null;
  /** Violations for any exceeded threshold. */
  violations: RateLimitViolation[];
  /** Suggested action (null if status is ok). */
  recommendation: string | null;
  /** Timestamp of measurement. */
  measuredAt: string;
}

export interface RateLimitSummary {
  totalProviders: number;
  okCount: number;
  approachingCount: number;
  throttledCount: number;
  blockedCount: number;
  /** Providers that are throttled or blocked. */
  criticalProviders: string[];
}

export interface BillingAiRatelimitInput {
  /** Comma-separated provider list. Default: all AI providers. */
  providers?: string;
  /** Period to evaluate. Default: "daily". */
  period?: TokenBudgetPeriod;
  /** Token budgets to enforce (JSON string or pre-parsed array). */
  budgets: TokenBudget[] | string;
  /** Warn when consumption exceeds this percent of budget. Default: 75. */
  warningThresholdPercent?: number;
  /** Soft-throttle when consumption exceeds this percent. Default: 90. */
  throttleThresholdPercent?: number;
}

export interface BillingAiRatelimitOutput {
  period: TokenBudgetPeriod;
  providers: ProviderRateLimitStatus[];
  summary: RateLimitSummary;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Module-level registry (future live-mode extensibility)
// ---------------------------------------------------------------------------

export interface AiRatelimitRegistry {
  /** Return actual token usage for the given provider and period. */
  getUsage(
    provider: string,
    period: TokenBudgetPeriod,
  ): Promise<{
    inputTokensUsed: number;
    outputTokensUsed: number;
    requestsUsed: number;
  }>;
}

let _ratelimitRegistry: AiRatelimitRegistry | null = null;

export function setAiRatelimitRegistry(registry: AiRatelimitRegistry): void {
  _ratelimitRegistry = registry;
}

export function _resetAiRatelimitRegistry(): void {
  _ratelimitRegistry = null;
}

// ---------------------------------------------------------------------------
// Deterministic usage fixtures (daily period)
// ---------------------------------------------------------------------------

// Realistic token usage fixtures — scaled to typical production AI workloads.
const DAILY_USAGE_FIXTURES: Record<
  string,
  { inputTokensUsed: number; outputTokensUsed: number; requestsUsed: number }
> = {
  anthropic: { inputTokensUsed: 12_400_000, outputTokensUsed: 1_980_000, requestsUsed: 8_420 },
  openai:    { inputTokensUsed: 9_800_000,  outputTokensUsed: 1_560_000, requestsUsed: 6_180 },
  google:    { inputTokensUsed: 28_600_000, outputTokensUsed: 4_520_000, requestsUsed: 14_300 },
  mistral:   { inputTokensUsed: 4_900_000,  outputTokensUsed: 780_000,   requestsUsed: 2_940 },
  deepseek:  { inputTokensUsed: 1_200_000,  outputTokensUsed: 192_000,   requestsUsed: 720 },
  alibaba:   { inputTokensUsed: 560_000,    outputTokensUsed: 89_600,    requestsUsed: 336 },
};

// Scale factors for different periods
const PERIOD_SCALE: Record<TokenBudgetPeriod, number> = {
  hourly:  1 / 24,
  daily:   1,
  monthly: 30,
};

const ALL_PROVIDERS = Object.keys(DAILY_USAGE_FIXTURES);

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function getUsageForProvider(
  provider: string,
  period: TokenBudgetPeriod,
): { inputTokensUsed: number; outputTokensUsed: number; requestsUsed: number } {
  const base = DAILY_USAGE_FIXTURES[provider] ?? {
    inputTokensUsed: 0,
    outputTokensUsed: 0,
    requestsUsed: 0,
  };
  const scale = PERIOD_SCALE[period];
  return {
    inputTokensUsed: Math.round(base.inputTokensUsed * scale),
    outputTokensUsed: Math.round(base.outputTokensUsed * scale),
    requestsUsed: Math.round(base.requestsUsed * scale),
  };
}

function computeViolation(
  limitType: RateLimitViolation["limitType"],
  limit: number | undefined,
  actual: number,
  warningPct: number,
  throttlePct: number,
): RateLimitViolation | null {
  if (limit === undefined || limit === null) return null;
  const pct = (actual / limit) * 100;
  if (pct < warningPct) return null;

  const action: RateLimitViolation["action"] =
    pct >= 100 ? "hard-block" : pct >= throttlePct ? "soft-throttle" : "warn";

  return {
    limitType,
    budgetLimit: limit,
    actualConsumption: actual,
    percentUsed: parseFloat(pct.toFixed(1)),
    action,
  };
}

function statusFromViolations(violations: RateLimitViolation[]): RateLimitStatus {
  if (violations.length === 0) return "ok";
  const maxAction = violations.reduce<RateLimitViolation["action"]>((max, v) => {
    const rank = { warn: 0, "soft-throttle": 1, "hard-block": 2 } as const;
    return rank[v.action] > rank[max] ? v.action : max;
  }, "warn");
  switch (maxAction) {
    case "hard-block":   return "blocked";
    case "soft-throttle": return "throttled";
    default:             return "approaching";
  }
}

function buildRecommendation(
  provider: string,
  status: RateLimitStatus,
  violations: RateLimitViolation[],
): string | null {
  if (status === "ok") return null;
  const worstViolation = violations.reduce<RateLimitViolation | null>((worst, v) => {
    if (!worst) return v;
    return v.percentUsed > worst.percentUsed ? v : worst;
  }, null);
  if (!worstViolation) return null;
  const limit = worstViolation.limitType.replace(/_/g, " ");
  switch (status) {
    case "approaching":
      return `${provider}: ${limit} at ${worstViolation.percentUsed}% — consider reducing request rate or upgrading tier.`;
    case "throttled":
      return `${provider}: ${limit} at ${worstViolation.percentUsed}% — implement request queuing and exponential backoff immediately.`;
    case "blocked":
      return `${provider}: ${limit} limit exceeded (${worstViolation.percentUsed}%) — requests are being rejected. Increase budget or wait for period reset.`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingAiRatelimitTool: McpToolDescriptor<
  BillingAiRatelimitInput,
  BillingAiRatelimitOutput
> = {
  id: "billing.ai.ratelimit",
  name: "Billing AI Rate Limit",
  description:
    "Enforce AI token budgets and track rate limits per provider and model. " +
    "Reports current token consumption against defined budgets, identifies providers " +
    "approaching or exceeding rate limits, and recommends throttling actions. " +
    "Supports hourly, daily, and monthly budget periods. " +
    "Complements billing.ai.quota (cost budgets) with token-level rate controls.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["budgets"],
    properties: {
      providers: {
        type: "string",
        description: `Comma-separated AI provider list. Default: all (${ALL_PROVIDERS.join(", ")}).`,
      },
      period: {
        type: "string",
        description: "Budget period to evaluate: 'hourly' | 'daily' | 'monthly'. Default: 'daily'.",
        enum: ["hourly", "daily", "monthly"],
      },
      budgets: {
        type: "string",
        description:
          "JSON array of TokenBudget objects. Each entry: { provider, period, maxInputTokens?, " +
          "maxOutputTokens?, maxTotalTokens?, maxRequests?, model? }.",
      },
      warningThresholdPercent: {
        type: "string",
        description: "Warn when consumption exceeds this percent of budget. Default: 75.",
      },
      throttleThresholdPercent: {
        type: "string",
        description: "Soft-throttle threshold percent. Default: 90.",
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingAiRatelimitOutput>> => {
    const { input, context } = envelope;

    const period: TokenBudgetPeriod = input.period ?? "daily";
    const warningPct = input.warningThresholdPercent ?? 75;
    const throttlePct = input.throttleThresholdPercent ?? 90;
    const measuredAt = new Date().toISOString();

    // Parse providers
    const requestedProviders = input.providers
      ? input.providers.split(",").map((p) => p.trim()).filter(Boolean)
      : ALL_PROVIDERS;

    // Parse budgets
    let budgets: TokenBudget[];
    if (typeof input.budgets === "string") {
      try {
        budgets = JSON.parse(input.budgets) as TokenBudget[];
      } catch {
        throw Object.assign(
          new Error("'budgets' must be a valid JSON array of TokenBudget objects."),
          { code: "INVALID_BUDGETS" },
        );
      }
    } else {
      budgets = input.budgets;
    }

    // Build a map: provider → budget
    const budgetMap = new Map<string, TokenBudget>();
    for (const b of budgets) {
      budgetMap.set(b.provider, b);
    }

    const providerStatuses: ProviderRateLimitStatus[] = [];

    for (const provider of requestedProviders) {
      // Fetch usage — live registry or deterministic fixture
      let usageData: { inputTokensUsed: number; outputTokensUsed: number; requestsUsed: number };
      if (_ratelimitRegistry !== null) {
        usageData = await _ratelimitRegistry.getUsage(provider, period);
      } else {
        usageData = getUsageForProvider(provider, period);
      }

      const budget = budgetMap.get(provider);
      const totalTokensUsed = usageData.inputTokensUsed + usageData.outputTokensUsed;

      const violations: RateLimitViolation[] = [];

      const inputViol = computeViolation(
        "input_tokens",
        budget?.maxInputTokens,
        usageData.inputTokensUsed,
        warningPct,
        throttlePct,
      );
      if (inputViol) violations.push(inputViol);

      const outputViol = computeViolation(
        "output_tokens",
        budget?.maxOutputTokens,
        usageData.outputTokensUsed,
        warningPct,
        throttlePct,
      );
      if (outputViol) violations.push(outputViol);

      const totalViol = computeViolation(
        "total_tokens",
        budget?.maxTotalTokens,
        totalTokensUsed,
        warningPct,
        throttlePct,
      );
      if (totalViol) violations.push(totalViol);

      const reqViol = computeViolation(
        "requests",
        budget?.maxRequests,
        usageData.requestsUsed,
        warningPct,
        throttlePct,
      );
      if (reqViol) violations.push(reqViol);

      const status = statusFromViolations(violations);
      const recommendation = buildRecommendation(provider, status, violations);

      providerStatuses.push({
        provider,
        ...(budget?.model !== undefined ? { model: budget.model } : {}),
        period,
        status,
        inputTokensUsed: usageData.inputTokensUsed,
        outputTokensUsed: usageData.outputTokensUsed,
        totalTokensUsed,
        requestsUsed: usageData.requestsUsed,
        inputTokensLimit: budget?.maxInputTokens ?? null,
        outputTokensLimit: budget?.maxOutputTokens ?? null,
        totalTokensLimit: budget?.maxTotalTokens ?? null,
        requestsLimit: budget?.maxRequests ?? null,
        violations,
        recommendation,
        measuredAt,
      });
    }

    const summary: RateLimitSummary = {
      totalProviders: providerStatuses.length,
      okCount:         providerStatuses.filter((p) => p.status === "ok").length,
      approachingCount: providerStatuses.filter((p) => p.status === "approaching").length,
      throttledCount:  providerStatuses.filter((p) => p.status === "throttled").length,
      blockedCount:    providerStatuses.filter((p) => p.status === "blocked").length,
      criticalProviders: providerStatuses
        .filter((p) => p.status === "throttled" || p.status === "blocked")
        .map((p) => p.provider),
    };

    const warnings: string[] = [];
    if (_ratelimitRegistry === null) {
      warnings.push(
        "Token usage data is deterministic (fixture). " +
        "Live token tracking requires a registered AiRatelimitRegistry.",
      );
    }
    if (summary.blockedCount > 0) {
      warnings.push(
        `${summary.blockedCount} provider(s) have exceeded their token budget and are in hard-block status.`,
      );
    }

    const output: BillingAiRatelimitOutput = {
      period,
      providers: providerStatuses,
      summary,
      warnings,
    };

    return {
      output,
      toolId: billingAiRatelimitTool.id,
      executedAt: measuredAt,
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.ai.ratelimit.token-budget",
        _ratelimitRegistry !== null
          ? "billing.ai.ratelimit.adapter.live"
          : "billing.ai.ratelimit.adapter.deterministic",
      ],
    };
  },
};
