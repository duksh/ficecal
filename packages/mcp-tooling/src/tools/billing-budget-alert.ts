// ─── billing.budget.alert — MCP tool ──────────────────────────────────────────
//
// Budget alerting / proactive spend alerts — compares actual and forecasted
// spend against defined budgets, surfacing alerts for each crossed threshold.
// Aligned with the FinOps Framework 2026 Budgeting/Forecasting capability.
//
// Tool id:   billing.budget.alert
// Namespace: billing
// Stability: beta

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderBudget {
  id: string;
  name: string;
  amount: number;
  currency: string;
  scope: "account" | "team" | "project" | "cost-center";
  scopeId: string;
}

export interface BudgetAlert {
  threshold: number;
  message: string;
  triggeredAt: string;
}

export interface BudgetStatus {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  actualSpend: number;
  forecastedSpend: number;
  percentUsed: number;
  percentForecasted: number;
  currency: string;
  scope: string;
  scopeId: string;
  status: "ok" | "warning" | "critical" | "exceeded";
  activeAlerts: BudgetAlert[];
  remainingBudget: number;
  daysInPeriod: number;
  daysElapsed: number;
  dailyBurnRate: number;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingBudgetAlertInput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  budgets: string | ProviderBudget[];
  alertThresholds?: number[];
}

export interface BillingBudgetAlertOutput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  budgetStatuses: BudgetStatus[];
  alertCount: number;
  criticalCount: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Deterministic spend fixtures
// ---------------------------------------------------------------------------

const PROVIDER_SPEND: Record<string, number> = {
  aws: 8450,
  gcp: 14280,
  azure: 6200,
  anthropic: 1840,
  openai: 2210,
};

const MOCK_ALERT_TRIGGERED_AT = "2026-03-15T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000));
}

function daysElapsedInPeriod(start: string): number {
  const s = new Date(start).getTime();
  const now = new Date("2026-03-22T00:00:00.000Z").getTime(); // deterministic "today"
  return Math.max(0, Math.round((now - s) / 86_400_000));
}

function computeStatus(
  percentUsed: number,
  percentForecasted: number,
): "ok" | "warning" | "critical" | "exceeded" {
  if (percentUsed > 100) return "exceeded";
  if (percentForecasted > 80 || percentUsed > 80) return "critical";
  if (percentForecasted > 50 || percentUsed > 50) return "warning";
  return "ok";
}

function buildAlerts(
  percentUsed: number,
  percentForecasted: number,
  budgetName: string,
  thresholds: number[],
  currency: string,
  budgetAmount: number,
  actualSpend: number,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  for (const threshold of thresholds) {
    if (percentUsed >= threshold) {
      alerts.push({
        threshold,
        message:
          threshold >= 100
            ? `Budget "${budgetName}" has been exceeded. Actual spend $${actualSpend.toFixed(2)} ${currency} vs budget $${budgetAmount.toFixed(2)} ${currency}.`
            : `Budget "${budgetName}" has reached ${threshold}% of the $${budgetAmount.toFixed(2)} ${currency} limit.`,
        triggeredAt: MOCK_ALERT_TRIGGERED_AT,
      });
    } else if (percentForecasted >= threshold) {
      alerts.push({
        threshold,
        message: `Budget "${budgetName}" is forecasted to reach ${threshold}% of the $${budgetAmount.toFixed(2)} ${currency} limit.`,
        triggeredAt: MOCK_ALERT_TRIGGERED_AT,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingBudgetAlertTool: McpToolDescriptor<
  BillingBudgetAlertInput,
  BillingBudgetAlertOutput
> = {
  id: "billing.budget.alert",
  name: "Billing Budget Alert",
  description:
    "Compares actual and forecasted spend against defined budgets, surfacing alerts " +
    "for each crossed threshold. Supports per-account, per-team, per-project, and " +
    "per-cost-center budget scopes. Aligned with the FinOps Framework 2026 " +
    "Budgeting/Forecasting capability.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["provider", "periodStart", "periodEnd", "budgets"],
    properties: {
      provider: {
        type: "string",
        description: "Cloud provider (aws, gcp, azure, anthropic, openai).",
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of billing period.",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of billing period.",
      },
      budgets: {
        type: "string",
        description:
          "JSON array of ProviderBudget objects, or a pre-parsed array. " +
          'Example: \'[{"id":"b1","name":"AWS Monthly","amount":10000,"currency":"USD","scope":"account","scopeId":"123456"}]\'',
      },
      alertThresholds: {
        type: "array",
        description: "Percent thresholds that trigger alerts. Default: [50, 80, 100].",
        items: { type: "number" },
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingBudgetAlertOutput>> => {
    const { input, context } = envelope;

    // ── Parse budgets ──────────────────────────────────────────────────────
    let budgets: ProviderBudget[];
    if (typeof input.budgets === "string") {
      try {
        budgets = JSON.parse(input.budgets) as ProviderBudget[];
      } catch {
        throw Object.assign(
          new Error("Failed to parse 'budgets' field as JSON. Provide a valid JSON array."),
          { code: "INVALID_BUDGETS_JSON" },
        );
      }
    } else {
      budgets = input.budgets;
    }

    if (!Array.isArray(budgets) || budgets.length === 0) {
      throw Object.assign(
        new Error("'budgets' must be a non-empty array of ProviderBudget objects."),
        { code: "EMPTY_BUDGETS" },
      );
    }

    const thresholds = (input.alertThresholds ?? [50, 80, 100]).slice().sort((a, b) => a - b);

    // ── Period timing ──────────────────────────────────────────────────────
    const daysInPeriod = daysBetween(input.periodStart, input.periodEnd);
    const daysElapsed = Math.min(daysElapsedInPeriod(input.periodStart), daysInPeriod);
    const elapsedFraction = daysElapsed / daysInPeriod;

    // ── Actual spend for this provider ─────────────────────────────────────
    const providerKey = input.provider.toLowerCase();
    const totalProviderSpend = PROVIDER_SPEND[providerKey] ?? 1000;

    // ── Build budget statuses ──────────────────────────────────────────────
    const budgetStatuses: BudgetStatus[] = budgets.map((budget) => {
      // Scale actual spend proportionally across budgets by scope
      const actualSpend = parseFloat((totalProviderSpend * elapsedFraction).toFixed(2));
      const dailyBurnRate =
        daysElapsed > 0 ? parseFloat((actualSpend / daysElapsed).toFixed(2)) : 0;
      const forecastedSpend = parseFloat((dailyBurnRate * daysInPeriod).toFixed(2));

      const percentUsed = parseFloat(((actualSpend / budget.amount) * 100).toFixed(2));
      const percentForecasted = parseFloat(
        ((forecastedSpend / budget.amount) * 100).toFixed(2),
      );
      const remainingBudget = parseFloat(
        Math.max(0, budget.amount - actualSpend).toFixed(2),
      );
      const status = computeStatus(percentUsed, percentForecasted);

      const activeAlerts = buildAlerts(
        percentUsed,
        percentForecasted,
        budget.name,
        thresholds,
        budget.currency,
        budget.amount,
        actualSpend,
      );

      return {
        budgetId: budget.id,
        budgetName: budget.name,
        budgetAmount: budget.amount,
        actualSpend,
        forecastedSpend,
        percentUsed,
        percentForecasted,
        currency: budget.currency,
        scope: budget.scope,
        scopeId: budget.scopeId,
        status,
        activeAlerts,
        remainingBudget,
        daysInPeriod,
        daysElapsed,
        dailyBurnRate,
      };
    });

    const alertCount = budgetStatuses.reduce((s, b) => s + b.activeAlerts.length, 0);
    const criticalCount = budgetStatuses.filter(
      (b) => b.status === "critical" || b.status === "exceeded",
    ).length;

    const warnings: string[] = [
      "Budget spend data is deterministic (fixture-based). Live ingestion available in a future release.",
    ];

    const output: BillingBudgetAlertOutput = {
      provider: input.provider,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      budgetStatuses,
      alertCount,
      criticalCount,
      warnings,
    };

    return {
      output,
      toolId: billingBudgetAlertTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.budget.alert.focus-aligned",
        "billing.budget.alert.deterministic",
      ],
    };
  },
};
