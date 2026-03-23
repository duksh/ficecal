// ─── billing.ai.cost.forecast — MCP tool ──────────────────────────────────────
//
// AI cost forecasting — projects future AI provider spend based on historical
// usage patterns using linear or exponential growth models.
// Aligned with the FinOps Framework 2026 AI Technology category.
//
// Tool id:   billing.ai.cost.forecast
// Namespace: billing
// Stability: experimental

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForecastDataPoint {
  date: string;
  forecastCost: number;
  lowerBound: number;
  upperBound: number;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingAiCostForecastInput {
  providers?: string;
  periodStart: string;
  periodEnd: string;
  forecastHorizonDays?: number;
  model?: "linear" | "exponential";
}

export interface BillingAiCostForecastOutput {
  providers: string[];
  historicalPeriod: { start: string; end: string; totalCost: number };
  forecastPeriod: { start: string; end: string };
  forecastTotalCost: number;
  forecastDailyCost: number;
  currency: string;
  confidence: "low" | "medium" | "high";
  growthRate: number;
  dataPoints: ForecastDataPoint[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Fixtures — historical spend per provider
// ---------------------------------------------------------------------------

const PROVIDER_HISTORICAL_SPEND: Record<string, number> = {
  anthropic: 1840.50,
  openai: 2210.30,
  google: 680.00,
  mistral: 145.80,
};

const KNOWN_PROVIDERS = Object.keys(PROVIDER_HISTORICAL_SPEND);
const DAILY_GROWTH_RATE = 0.005; // 0.5% per day
const BOUND_MARGIN = 0.15; // ±15%

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeConfidence(horizonDays: number): "low" | "medium" | "high" {
  if (horizonDays <= 30) return "high";
  if (horizonDays <= 90) return "medium";
  return "low";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingAiCostForecastTool: McpToolDescriptor<
  BillingAiCostForecastInput,
  BillingAiCostForecastOutput
> = {
  id: "billing.ai.cost.forecast",
  name: "Billing AI Cost Forecast",
  description:
    "Projects future AI provider spend based on historical usage patterns using linear " +
    "or exponential growth models. Generates day-by-day forecast data points with " +
    "confidence bounds. Aligned with the FinOps Framework 2026 AI Technology category.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["periodStart", "periodEnd"],
    properties: {
      providers: {
        type: "string",
        description:
          "Comma-separated AI providers. Default: all (anthropic,openai,google,mistral).",
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — historical period start.",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — historical period end.",
      },
      forecastHorizonDays: {
        type: "number",
        description: "Number of days to forecast ahead. Default: 30. Max: 365.",
      },
      model: {
        type: "string",
        description: "Growth model: 'linear' or 'exponential'. Default: 'linear'.",
        enum: ["linear", "exponential"],
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingAiCostForecastOutput>> => {
    const { input, context } = envelope;

    const growthModel = input.model ?? "linear";
    const rawHorizon = input.forecastHorizonDays ?? 30;
    const forecastHorizonDays = Math.min(Math.max(1, rawHorizon), 365);

    const providers =
      !input.providers || input.providers.trim() === ""
        ? KNOWN_PROVIDERS
        : input.providers.split(",").map((p) => p.trim().toLowerCase());

    const warnings: string[] = [
      "AI cost forecast is deterministic (fixture-based). Live usage integration available in a future release.",
    ];

    if (rawHorizon > 365) {
      warnings.push("forecastHorizonDays capped at 365.");
    }

    // ── Historical total ───────────────────────────────────────────────────
    const historicalTotal = providers.reduce((sum, p) => {
      return sum + (PROVIDER_HISTORICAL_SPEND[p] ?? 0);
    }, 0);

    const unknownProviders = providers.filter((p) => !KNOWN_PROVIDERS.includes(p));
    if (unknownProviders.length > 0) {
      warnings.push(
        `Unknown providers ignored: ${unknownProviders.join(", ")}. ` +
        `Known: ${KNOWN_PROVIDERS.join(", ")}.`,
      );
    }

    const daysInPeriod = daysBetween(input.periodStart, input.periodEnd);
    const historicalDailyRate = historicalTotal / daysInPeriod;

    // ── Forecast data points ───────────────────────────────────────────────
    const forecastStart = addDays(input.periodEnd, 1);
    const forecastEnd = addDays(input.periodEnd, forecastHorizonDays);

    const dataPoints: ForecastDataPoint[] = [];
    let forecastTotalCost = 0;

    for (let day = 0; day < forecastHorizonDays; day++) {
      let dailyCost: number;
      if (growthModel === "linear") {
        dailyCost = historicalDailyRate * (1 + DAILY_GROWTH_RATE * day);
      } else {
        // exponential: compound growth
        dailyCost = historicalDailyRate * Math.pow(1 + DAILY_GROWTH_RATE, day);
      }

      forecastTotalCost += dailyCost;

      dataPoints.push({
        date: addDays(forecastStart, day),
        forecastCost: round2(dailyCost),
        lowerBound: round2(dailyCost * (1 - BOUND_MARGIN)),
        upperBound: round2(dailyCost * (1 + BOUND_MARGIN)),
      });
    }

    const forecastDailyCost =
      dataPoints.length > 0
        ? round2(forecastTotalCost / dataPoints.length)
        : 0;

    const output: BillingAiCostForecastOutput = {
      providers: providers.filter((p) => KNOWN_PROVIDERS.includes(p)),
      historicalPeriod: {
        start: input.periodStart,
        end: input.periodEnd,
        totalCost: round2(historicalTotal),
      },
      forecastPeriod: {
        start: forecastStart,
        end: forecastEnd,
      },
      forecastTotalCost: round2(forecastTotalCost),
      forecastDailyCost,
      currency: "USD",
      confidence: computeConfidence(forecastHorizonDays),
      growthRate: DAILY_GROWTH_RATE * 100, // as percent
      dataPoints,
      warnings,
    };

    return {
      output,
      toolId: billingAiCostForecastTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.ai.forecast.linear",
        "billing.ai.forecast.deterministic",
      ],
    };
  },
};
