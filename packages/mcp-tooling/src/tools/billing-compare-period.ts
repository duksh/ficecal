// ─── billing.compare.period — MCP tool ────────────────────────────────────────
//
// Compare actual billing between two time periods for the same provider.
// Returns delta cost, percentage change, and per-service breakdowns.
//
// Tool id: billing.compare.period
// Namespace: billing
// Stability: beta
//
// ─── Phase 8B: FOCUS field alignment ─────────────────────────────────────────
//
// ServiceDelta now uses `serviceName` (the FOCUS 1.3 canonical field name)
// as the primary service identifier. The underlying aggregation reads from
// the BillingPeriodSummary adapter output; Phase 10 native adapters that
// return NormalizedCostRecord[] are also handled via the Array.isArray branch.

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type { BillingAdapterRegistry } from "./billing-estimate-actual.js";
import { _resetBillingRegistry } from "./billing-estimate-actual.js";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";

export { _resetBillingRegistry };

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface BillingComparePeriodInput {
  provider: string;
  baselineStart: string;   // ISO date
  baselineEnd: string;     // ISO date
  comparisonStart: string; // ISO date
  comparisonEnd: string;   // ISO date
}

export interface ServiceDelta {
  /** FOCUS 1.3: ServiceName — canonical service identifier. */
  serviceName: string;
  baselineCost: number;
  comparisonCost: number;
  deltaCost: number;
  deltaPercent: number | null; // null if baselineCost was 0
}

export interface BillingComparePeriodOutput {
  provider: string;
  baselinePeriod: { start: string; end: string; totalCost: number };
  comparisonPeriod: { start: string; end: string; totalCost: number };
  currency: string;
  deltaCost: number;
  deltaPercent: number | null;
  trend: "increase" | "decrease" | "flat";
  serviceDeltas: ServiceDelta[];
  /** FOCUS schema version used by the underlying adapter output. */
  focusSchemaVersion: string;
  warnings: string[];
}

// ─── Module-level registry (shared with billing-estimate-actual) ───────────────

let _billingRegistry: BillingAdapterRegistry | null = null;

export function setBillingRegistry(registry: BillingAdapterRegistry): void {
  _billingRegistry = registry;
}

// ─── Internal aggregation helpers ─────────────────────────────────────────────

/** Extract service name from either a BillingLineItem (Phase 9) or NormalizedCostRecord (Phase 10). */
function extractServiceName(item: Record<string, unknown>): string {
  // NormalizedCostRecord (Phase 10): serviceName field
  if (typeof item["serviceName"] === "string") return item["serviceName"];
  // BillingPeriodSummary.lineItem (Phase 9): service field
  if (typeof item["service"] === "string") return item["service"];
  return "Unknown";
}

/** Extract cost as a number from either record shape. */
function extractCost(item: Record<string, unknown>): number {
  // NormalizedCostRecord: amount is a decimal-safe string
  if (typeof item["amount"] === "string") return parseFloat(item["amount"]);
  // BillingPeriodSummary.lineItem: cost is a number
  if (typeof item["cost"] === "number") return item["cost"];
  return 0;
}

type PeriodData = {
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalCost: number;
  currency: string;
  lineItems: Array<Record<string, unknown>>;
};

function normalisePeriodData(raw: unknown, periodStart: string, periodEnd: string): PeriodData {
  if (Array.isArray(raw)) {
    // Phase 10 native adapter: NormalizedCostRecord[]
    const records = raw as Array<Record<string, unknown>>;
    const totalCost = records.reduce((sum, r) => sum + extractCost(r), 0);
    const currency = (typeof records[0]?.["currency"] === "string" ? records[0]["currency"] : "USD") as string;
    return {
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      totalCost,
      currency,
      lineItems: records,
    };
  }

  // Phase 9 adapter: BillingPeriodSummary shape
  const data = raw as {
    billingPeriodStart: string;
    billingPeriodEnd: string;
    totalCost: number;
    currency: string;
    lineItems: Array<Record<string, unknown>>;
  };
  return data;
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const billingComparePeriodTool: McpToolDescriptor<BillingComparePeriodInput, BillingComparePeriodOutput> = {
  id: "billing.compare.period",
  name: "Billing Compare Period",
  description:
    "Compare actual cloud billing costs between two time periods for the same provider. " +
    "Returns total delta, percentage change, trend, and per-service cost breakdowns. " +
    "ServiceDelta uses FOCUS 1.3 serviceName as the canonical service identifier. " +
    "Phase 8B: handles both Phase 9 BillingPeriodSummary and Phase 10 NormalizedCostRecord[] adapter output.",
  namespace: "billing",
  stability: "beta",
  inputSchema: {
    type: "object",
    properties: {
      provider: { type: "string", description: "Cloud provider: aws | gcp | azure | openai" },
      baselineStart: { type: "string", description: "Baseline period start (YYYY-MM-DD)" },
      baselineEnd: { type: "string", description: "Baseline period end (YYYY-MM-DD)" },
      comparisonStart: { type: "string", description: "Comparison period start (YYYY-MM-DD)" },
      comparisonEnd: { type: "string", description: "Comparison period end (YYYY-MM-DD)" },
    },
    required: ["provider", "baselineStart", "baselineEnd", "comparisonStart", "comparisonEnd"],
  },

  handler: async (envelope) => {
    const { input, context } = envelope;

    if (_billingRegistry === null) {
      throw new Error("BillingAdapterRegistry not initialised. Call setBillingRegistry() at startup.");
    }

    const adapter = _billingRegistry.getAdapter(input.provider);
    if (!adapter) {
      throw Object.assign(
        new Error(`No billing adapter registered for provider "${input.provider}".`),
        { code: "PROVIDER_NOT_FOUND" },
      );
    }

    const [baselineRaw, comparisonRaw] = await Promise.all([
      adapter.load(input.baselineStart, input.baselineEnd),
      adapter.load(input.comparisonStart, input.comparisonEnd),
    ]);

    const baseline = normalisePeriodData(baselineRaw, input.baselineStart, input.baselineEnd);
    const comparison = normalisePeriodData(comparisonRaw, input.comparisonStart, input.comparisonEnd);

    // Build per-service maps using FOCUS-aligned serviceName extraction
    const baselineByService = new Map<string, number>();
    for (const li of baseline.lineItems) {
      const svc = extractServiceName(li);
      baselineByService.set(svc, (baselineByService.get(svc) ?? 0) + extractCost(li));
    }
    const comparisonByService = new Map<string, number>();
    for (const li of comparison.lineItems) {
      const svc = extractServiceName(li);
      comparisonByService.set(svc, (comparisonByService.get(svc) ?? 0) + extractCost(li));
    }

    const allServices = new Set([...baselineByService.keys(), ...comparisonByService.keys()]);
    const serviceDeltas: ServiceDelta[] = [...allServices].map((serviceName) => {
      const b = baselineByService.get(serviceName) ?? 0;
      const c = comparisonByService.get(serviceName) ?? 0;
      return {
        serviceName,
        baselineCost: Number(b.toFixed(2)),
        comparisonCost: Number(c.toFixed(2)),
        deltaCost: Number((c - b).toFixed(2)),
        deltaPercent: b !== 0 ? Number((((c - b) / b) * 100).toFixed(1)) : null,
      };
    });

    const totalBaseline = Number(baseline.totalCost.toFixed(2));
    const totalComparison = Number(comparison.totalCost.toFixed(2));
    const deltaCost = Number((totalComparison - totalBaseline).toFixed(2));
    const deltaPercent =
      totalBaseline !== 0
        ? Number((((totalComparison - totalBaseline) / totalBaseline) * 100).toFixed(1))
        : null;

    const trend: "increase" | "decrease" | "flat" =
      deltaCost > 0 ? "increase" : deltaCost < 0 ? "decrease" : "flat";

    const fixtureVersion = _billingRegistry.getFixture(input.provider)?.version;
    const warnings: string[] = fixtureVersion
      ? [
          `Billing data is deterministic (fixture v${fixtureVersion}). ` +
          "ServiceDelta costs reflect fixture values; live data will differ.",
        ]
      : [];

    const output: BillingComparePeriodOutput = {
      provider: input.provider,
      baselinePeriod: {
        start: baseline.billingPeriodStart,
        end: baseline.billingPeriodEnd,
        totalCost: totalBaseline,
      },
      comparisonPeriod: {
        start: comparison.billingPeriodStart,
        end: comparison.billingPeriodEnd,
        totalCost: totalComparison,
      },
      currency: baseline.currency,
      deltaCost,
      deltaPercent,
      trend,
      serviceDeltas,
      focusSchemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,
      warnings,
    };

    return {
      output,
      toolId: billingComparePeriodTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.compare.focus-aligned",
        "billing.schema.2.0.0",
        fixtureVersion ? "billing.adapter.deterministic" : "billing.adapter.live",
      ],
    };
  },
};
