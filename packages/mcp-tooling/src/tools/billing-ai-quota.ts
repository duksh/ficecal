// ─── billing.ai.quota — MCP tool ─────────────────────────────────────────────
//
// AI spend quota management — checks current AI provider spend against
// per-workspace monthly budgets and surfaces quota status, overage risk,
// and pacing alerts.
//
// Aligned with FinOps Framework 2026 AI Technology category.
// Uses FOCUS 1.3 BilledCost semantics for spend tracking.
//
// Tool id: billing.ai.quota
// Namespace: billing
// Stability: beta
// Phase: 11

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface ProviderQuota {
  provider: string;
  monthlyBudgetUsd: number;
  /** Alert threshold (0–1). Default: 0.80. */
  alertThreshold?: number;
}

export interface BillingAiQuotaInput {
  /** Workspace identifier. Used to scope spend data. */
  workspaceId?: string;
  /**
   * Comma-separated AI providers (e.g. "anthropic,openai,google").
   * Default: all known AI providers.
   */
  providers?: string;
  /** ISO date "YYYY-MM-DD" — start of current period to evaluate. */
  periodStart: string;
  periodEnd: string;
  /**
   * JSON-encoded quota array, or accepts a pre-parsed array.
   * Example: '[{"provider":"anthropic","monthlyBudgetUsd":2000}]'
   * This field accepts the raw JSON string when called via MCP HTTP,
   * or a pre-parsed array when called programmatically.
   */
  quotas: ProviderQuota[] | string;
}

export type QuotaStatus =
  | "within-budget"
  | "approaching"
  | "exceeded"
  | "unbudgeted";

export interface ProviderQuotaStatus {
  provider: string;
  /** Current period spend (USD), decimal-safe string. */
  currentSpendUsd: string;
  /** Monthly budget (USD). null if unbudgeted. */
  monthlyBudgetUsd: number | null;
  /** Spend as percent of budget. null if unbudgeted. */
  spendPercent: number | null;
  /** Remaining budget (USD). null if unbudgeted or exceeded. */
  remainingBudgetUsd: number | null;
  /** Days elapsed in the period / total days. */
  periodElapsedFraction: number;
  /** Paced spend to date. null if unbudgeted. */
  pacedExpectedSpendUsd: number | null;
  /** True if spending faster than linear pace. */
  aheadOfPace: boolean | null;
  /** Estimated month-end spend based on current burn rate. */
  projectedMonthEndSpendUsd: number | null;
  quotaStatus: QuotaStatus;
  alertThreshold: number;
  recommendation: string;
}

export interface AiQuotaSummary {
  totalCurrentSpendUsd: string;
  totalBudgetUsd: number;
  providersExceeded: string[];
  providersApproaching: string[];
  providersUnbudgeted: string[];
  overallStatus: "healthy" | "warning" | "critical";
}

export interface BillingAiQuotaOutput {
  workspaceId: string | null;
  quotaStatuses: ProviderQuotaStatus[];
  summary: AiQuotaSummary;
  periodStart: string;
  periodEnd: string;
  ingestMode: "deterministic" | "live" | "mixed";
  computedAt: string;
  warnings: string[];
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface AiQuotaAdapterRegistry {
  getRecords(
    provider: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<NormalizedCostRecord[]>;
  listProviders(): string[];
  getMode(): "deterministic" | "live" | "mixed";
}

// ─── Module-level registry ────────────────────────────────────────────────────

let _quotaRegistry: AiQuotaAdapterRegistry | null = null;

export function setAiQuotaBillingRegistry(registry: AiQuotaAdapterRegistry): void {
  _quotaRegistry = registry;
}

export function _resetAiQuotaBillingRegistry(): void {
  _quotaRegistry = null;
}

// ─── Deterministic spend fixtures ─────────────────────────────────────────────

const AI_SPEND_FIXTURES: Record<string, number> = {
  anthropic:  1_840.50,
  openai:     2_210.30,
  google:       680.00,
  mistral:      145.80,
  deepseek:      28.40,
  alibaba:       12.00,
};

// ─── Period helpers ───────────────────────────────────────────────────────────

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000));
}

function daysElapsed(start: string, end: string, now: Date): number {
  const s       = new Date(start).getTime();
  const e       = new Date(end).getTime();
  const total   = e - s;
  const elapsed = Math.min(Math.max(now.getTime() - s, 0), total);
  return Math.round(elapsed / 86_400_000);
}

// ─── Core logic ───────────────────────────────────────────────────────────────

function buildQuotaStatus(
  provider: string,
  spendUsd: number,
  quota: ProviderQuota | undefined,
  periodStart: string,
  periodEnd: string,
  now: Date,
): ProviderQuotaStatus {
  const totalDays   = daysBetween(periodStart, periodEnd);
  const elapsed     = daysElapsed(periodStart, periodEnd, now);
  const elapsedFrac = elapsed / totalDays;

  if (!quota) {
    return {
      provider,
      currentSpendUsd:           spendUsd.toFixed(10),
      monthlyBudgetUsd:          null,
      spendPercent:              null,
      remainingBudgetUsd:        null,
      periodElapsedFraction:     elapsedFrac,
      pacedExpectedSpendUsd:     null,
      aheadOfPace:               null,
      projectedMonthEndSpendUsd: elapsedFrac > 0
        ? Math.round((spendUsd / elapsedFrac) * 100) / 100
        : null,
      quotaStatus:               "unbudgeted",
      alertThreshold:            0.80,
      recommendation:
        `Provider "${provider}" has $${spendUsd.toFixed(2)} in spend but no quota defined. ` +
        `Consider setting a monthly budget to track spend-vs-plan.`,
    };
  }

  const budget    = quota.monthlyBudgetUsd;
  const threshold = quota.alertThreshold ?? 0.80;
  const spendPct  = Math.round((spendUsd / budget) * 1000) / 10;
  const remaining = Math.max(0, budget - spendUsd);
  const paced     = budget * elapsedFrac;
  const ahead     = spendUsd > paced;
  const projected = elapsedFrac > 0
    ? Math.round((spendUsd / elapsedFrac) * 100) / 100
    : spendUsd;

  let quotaStatus: QuotaStatus;
  let recommendation: string;

  if (spendUsd > budget) {
    quotaStatus = "exceeded";
    recommendation =
      `EXCEEDED: ${provider} spend ($${spendUsd.toFixed(2)}) has surpassed the ` +
      `$${budget.toFixed(2)} monthly budget by $${(spendUsd - budget).toFixed(2)}. ` +
      `Immediate action required — review workload consumption and apply rate limits.`;
  } else if (spendUsd >= threshold * budget) {
    quotaStatus = "approaching";
    recommendation =
      `APPROACHING: ${provider} spend ($${spendUsd.toFixed(2)}) is at ${spendPct}% of ` +
      `the $${budget.toFixed(2)} budget with ${Math.round((1 - elapsedFrac) * totalDays)} days remaining. ` +
      `Current burn rate projects $${projected.toFixed(2)} by month-end. ` +
      `Consider throttling non-critical workloads.`;
  } else {
    quotaStatus = "within-budget";
    recommendation =
      `${provider} spend ($${spendUsd.toFixed(2)}) is at ${spendPct}% of the ` +
      `$${budget.toFixed(2)} budget — on track.` +
      (ahead
        ? ` Running ${Math.round(((spendUsd - paced) / paced) * 100)}% ahead of linear pace.`
        : "");
  }

  return {
    provider,
    currentSpendUsd:           spendUsd.toFixed(10),
    monthlyBudgetUsd:          budget,
    spendPercent:              spendPct,
    remainingBudgetUsd:        Math.round(remaining * 100) / 100,
    periodElapsedFraction:     elapsedFrac,
    pacedExpectedSpendUsd:     Math.round(paced * 100) / 100,
    aheadOfPace:               ahead,
    projectedMonthEndSpendUsd: projected,
    quotaStatus,
    alertThreshold:            threshold,
    recommendation,
  };
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const billingAiQuotaTool: McpToolDescriptor<
  BillingAiQuotaInput,
  BillingAiQuotaOutput
> = {
  id: "billing.ai.quota",
  name: "AI Spend Quota Status",
  namespace: "billing",
  stability: "beta",
  description:
    "Checks current AI provider spend against per-workspace monthly budgets. " +
    "Surfaces quota status (within-budget | approaching | exceeded | unbudgeted), " +
    "pacing alerts, and projected month-end spend per provider. " +
    "Supports all AI providers in the FiceCal model catalog. " +
    "Aligned with FinOps Framework 2026 AI Technology capability and FOCUS 1.3.",
  inputSchema: {
    type: "object",
    required: ["periodStart", "periodEnd", "quotas"],
    properties: {
      workspaceId:  { type: "string", description: "Workspace identifier for spend scoping." },
      providers:    {
        type: "string",
        description: "Comma-separated AI providers (anthropic,openai,google,…). Default: all.",
      },
      periodStart:  { type: "string", description: "ISO date YYYY-MM-DD — period start." },
      periodEnd:    { type: "string", description: "ISO date YYYY-MM-DD — period end." },
      quotas: {
        type: "string",
        description:
          'JSON array of quota objects: [{"provider":"anthropic","monthlyBudgetUsd":2000,"alertThreshold":0.8}].',
      },
    },
  },
  async handler(envelope) {
    const { input, context } = envelope;

    if (!input.periodStart || !input.periodEnd) {
      throw new Error("Missing required fields: periodStart, periodEnd");
    }
    if (!input.quotas) {
      throw new Error("Missing required field: quotas");
    }

    // Parse quotas — accepts both pre-parsed array and JSON string
    let parsedQuotas: ProviderQuota[];
    if (typeof input.quotas === "string") {
      try {
        parsedQuotas = JSON.parse(input.quotas) as ProviderQuota[];
      } catch {
        throw new Error("Invalid quotas format — expected JSON array of {provider, monthlyBudgetUsd}.");
      }
    } else {
      parsedQuotas = input.quotas;
    }

    const knownAiProviders = [
      "anthropic", "openai", "google", "mistral", "deepseek", "alibaba",
    ];
    const providers =
      !input.providers || input.providers.trim() === ""
        ? knownAiProviders
        : input.providers.split(",").map((p) => p.trim());

    const quotaMap = new Map<string, ProviderQuota>(
      parsedQuotas.map((q) => [q.provider, q]),
    );

    const warnings: string[] = [];
    let ingestMode: "deterministic" | "live" | "mixed" = "deterministic";

    const spendMap = new Map<string, number>();

    if (_quotaRegistry !== null) {
      ingestMode = _quotaRegistry.getMode();
      for (const provider of providers) {
        if (!_quotaRegistry.listProviders().includes(provider)) continue;
        try {
          const records = await _quotaRegistry.getRecords(
            provider,
            input.periodStart,
            input.periodEnd,
          );
          const totalSpend = records.reduce(
            (sum, r) => sum + (r.billedCost !== undefined ? parseFloat(r.billedCost) : 0),
            0,
          );
          spendMap.set(provider, totalSpend);
        } catch {
          warnings.push(
            `Failed to load live spend for "${provider}" — using fixture data.`,
          );
        }
      }
    }

    for (const provider of providers) {
      if (!spendMap.has(provider)) {
        spendMap.set(provider, AI_SPEND_FIXTURES[provider] ?? 0);
      }
    }

    const now = new Date();
    const statuses: ProviderQuotaStatus[] = providers.map((provider) =>
      buildQuotaStatus(
        provider,
        spendMap.get(provider) ?? 0,
        quotaMap.get(provider),
        input.periodStart,
        input.periodEnd,
        now,
      ),
    );

    const statusOrder: Record<QuotaStatus, number> = {
      exceeded:          0,
      approaching:       1,
      "within-budget":   2,
      unbudgeted:        3,
    };
    statuses.sort(
      (a, b) => statusOrder[a.quotaStatus] - statusOrder[b.quotaStatus],
    );

    const totalSpend  = statuses.reduce(
      (sum, s) => sum + parseFloat(s.currentSpendUsd),
      0,
    );
    const totalBudget = parsedQuotas.reduce(
      (sum, q) => sum + q.monthlyBudgetUsd,
      0,
    );

    const exceeded    = statuses.filter((s) => s.quotaStatus === "exceeded").map((s) => s.provider);
    const approaching = statuses.filter((s) => s.quotaStatus === "approaching").map((s) => s.provider);
    const unbudgeted  = statuses.filter((s) => s.quotaStatus === "unbudgeted").map((s) => s.provider);

    const overallStatus =
      exceeded.length > 0 ? "critical" :
      approaching.length > 0 ? "warning" :
      "healthy";

    const output: BillingAiQuotaOutput = {
      workspaceId:   input.workspaceId ?? null,
      quotaStatuses: statuses,
      summary: {
        totalCurrentSpendUsd:   totalSpend.toFixed(10),
        totalBudgetUsd:         totalBudget,
        providersExceeded:      exceeded,
        providersApproaching:   approaching,
        providersUnbudgeted:    unbudgeted,
        overallStatus,
      },
      periodStart:  input.periodStart,
      periodEnd:    input.periodEnd,
      ingestMode,
      computedAt:   now.toISOString(),
      warnings,
    };

    const result: McpToolResult<BillingAiQuotaOutput> = {
      output,
      toolId:     billingAiQuotaTool.id,
      executedAt: now.toISOString(),
      requestId:  context.requestId,
      warnings,
      appliedIds: [
        "billing.ai.quota.status.v1",
        "billing.ai.quota.pacing.linear.v1",
      ],
    };
    return result;
  },
};
