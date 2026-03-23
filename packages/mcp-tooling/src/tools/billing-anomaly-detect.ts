// ─── billing.anomaly.detect — MCP tool ────────────────────────────────────────
//
// Detects cost anomalies by comparing a current billing period against a
// baseline period for one or more providers.
//
// Algorithm:
//   1. Load NormalizedCostRecord[] for current + baseline periods per provider
//   2. Group by serviceName, sum amount per group
//   3. Join on serviceName; compute relative delta %
//   4. Flag services where |deltaPercent| > thresholdPercent (default 50)
//   5. Severity: warning >50%, critical >100% over baseline
//   6. Rank anomalies by deltaAmount DESC (largest absolute overspend first)
//
// Tool id: billing.anomaly.detect
// Namespace: billing
// Stability: beta
// Phase: 10A P0

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface BillingAnomalyDetectInput {
  /** Providers to analyse. Defaults to all registered providers if omitted. */
  providers: string[];
  currentPeriodStart: string;    // ISO date "YYYY-MM-DD"
  currentPeriodEnd: string;
  baselinePeriodStart: string;
  baselinePeriodEnd: string;
  /**
   * Minimum delta % to flag as an anomaly. Default 50 — i.e. any service
   * spending >50% more than baseline is surfaced.
   */
  thresholdPercent?: number;
}

export type AnomalySeverity = "warning" | "critical";
export type OverallSeverity  = "none" | "warning" | "critical";

export interface AnomalyRecord {
  /** FOCUS 1.3 ServiceName. */
  serviceName: string;
  provider: string;

  /** Decimal-safe string amounts (USD). */
  currentSpend: string;
  baselineSpend: string;

  /** Positive = increase vs baseline; negative = decrease. */
  deltaPercent: number;
  deltaAmount: string;

  severity: AnomalySeverity;

  /**
   * Projected monthly overage if the current-period rate continues for 30 days.
   * Only populated when currentPeriodEnd - currentPeriodStart < 30 days
   * (i.e. it's a partial-month comparison).
   */
  projectedMonthlyOverage?: string;

  recommendation: string;
}

export interface BillingAnomalyOutput {
  anomalies: AnomalyRecord[];        // ranked by deltaAmount DESC
  totalCurrentSpend: string;
  totalBaselineSpend: string;
  totalDeltaPercent: number;
  overallSeverity: OverallSeverity;
  currentPeriod:  { start: string; end: string };
  baselinePeriod: { start: string; end: string };
  providersCovered: string[];
  anomalyCount: number;
  thresholdPercent: number;
  ingestMode: "deterministic" | "live" | "mixed";
}

// ─── Registry interface (same shape as billing-estimate-actual) ───────────────

export interface AnomalyBillingRegistry {
  getAdapter(provider: string): {
    load(start: string, end: string): Promise<unknown>;
    ingestMode?: "deterministic" | "live";
  } | undefined;
  getFixture(provider: string): { version: string } | undefined;
}

// ─── Module-level registry ─────────────────────────────────────────────────────

let _billingRegistry: AnomalyBillingRegistry | null = null;

export function setAnomalyBillingRegistry(registry: AnomalyBillingRegistry): void {
  _billingRegistry = registry;
}

export function _resetAnomalyBillingRegistry(): void {
  _billingRegistry = null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse BillingPeriodSummary or NormalizedCostRecord[] from adapter.load(). */
function extractRecords(raw: unknown): NormalizedCostRecord[] {
  if (Array.isArray(raw)) {
    // Phase 10 native adapter: already NormalizedCostRecord[]
    return raw as NormalizedCostRecord[];
  }
  // Phase 9 adapter: BillingPeriodSummary — extract lineItems as minimal records
  const data = raw as {
    provider: string;
    accountId?: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    totalCost: number;
    currency: string;
    lineItems: Array<{ service: string; cost: number; currency: string; startDate: string; endDate: string; sku?: string }>;
  };
  return data.lineItems.map((li, idx) => ({
    recordId: `${data.provider}:${li.service}:${idx}`,
    sourceSystem: `ficecal-billing-${data.provider}`,
    provider: data.provider,
    providerRole: "direct-provider" as const,
    billingPeriodStart: data.billingPeriodStart,
    billingPeriodEnd: data.billingPeriodEnd,
    chargePeriodStart: li.startDate,
    chargePeriodEnd: li.endDate,
    currency: li.currency,
    amount: li.cost.toFixed(10),
    amountType: "actual" as const,
    serviceName: li.service,
    dataCompleteness: "partial" as const,
    ingestedAt: new Date().toISOString(),
    schemaVersion: "2.0.0",
  }));
}

/** Group NormalizedCostRecord[] by serviceName → total amount map. */
function groupByService(records: NormalizedCostRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = r.serviceName ?? r.recordId;
    map.set(key, (map.get(key) ?? 0) + parseFloat(r.amount));
  }
  return map;
}

/** Days between two ISO date strings. */
function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Build a human-readable recommendation for an anomaly. */
function buildRecommendation(
  serviceName: string,
  deltaPercent: number,
  deltaAmount: number,
  severity: AnomalySeverity,
): string {
  const direction = deltaPercent > 0 ? "increase" : "decrease";
  const pct = Math.abs(deltaPercent).toFixed(1);
  const amt = Math.abs(deltaAmount).toFixed(2);

  if (severity === "critical") {
    return (
      `${serviceName} spend has ${direction}d by ${pct}% ($${amt}) vs baseline — ` +
      `review recent deployments, traffic spikes, or configuration changes immediately.`
    );
  }
  return (
    `${serviceName} spend ${direction}d by ${pct}% ($${amt}) vs baseline — ` +
    `monitor over the next 24h and verify against planned usage changes.`
  );
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const billingAnomalyDetectTool: McpToolDescriptor<BillingAnomalyDetectInput, BillingAnomalyOutput> = {
  id: "billing.anomaly.detect",
  name: "Billing Anomaly Detect",
  description:
    "Compare cloud spend across two billing periods and surface cost anomalies. " +
    "Groups FOCUS 1.3-normalised records by service, computes relative delta, " +
    "and flags services exceeding the threshold (default 50% over baseline). " +
    "Severity: warning >50%, critical >100%. Results ranked by absolute overspend. " +
    "Phase 10A: foundation for active FinOps alerting and anomaly notification.",
  namespace: "billing",
  stability: "beta",
  inputSchema: {
    type: "object",
    properties: {
      providers:            { type: "string", description: "Providers to analyse (comma-separated, e.g. \"aws,openai\")" },
      currentPeriodStart:  { type: "string",  description: "Current period start date YYYY-MM-DD" },
      currentPeriodEnd:    { type: "string",  description: "Current period end date YYYY-MM-DD" },
      baselinePeriodStart: { type: "string",  description: "Baseline period start date YYYY-MM-DD" },
      baselinePeriodEnd:   { type: "string",  description: "Baseline period end date YYYY-MM-DD" },
      thresholdPercent:    { type: "number",  description: "Minimum delta % to flag (default 50)" },
    },
    required: ["providers", "currentPeriodStart", "currentPeriodEnd", "baselinePeriodStart", "baselinePeriodEnd"],
  },

  handler: async (envelope) => {
    const { input, context } = envelope;

    if (_billingRegistry === null) {
      throw new Error("AnomalyBillingRegistry not initialised. Call setAnomalyBillingRegistry() at startup.");
    }

    const threshold = input.thresholdPercent ?? 50;
    const providers = input.providers;

    // ── Fetch current + baseline records for all providers ───────────────────
    const currentByService  = new Map<string, { amount: number; provider: string }>();
    const baselineByService = new Map<string, { amount: number; provider: string }>();
    const ingestModes: Set<"deterministic" | "live"> = new Set();

    for (const provider of providers) {
      const adapter = _billingRegistry.getAdapter(provider);
      if (!adapter) continue;

      const mode = adapter.ingestMode ?? "deterministic";
      ingestModes.add(mode);

      const [currentRaw, baselineRaw] = await Promise.all([
        adapter.load(input.currentPeriodStart, input.currentPeriodEnd),
        adapter.load(input.baselinePeriodStart, input.baselinePeriodEnd),
      ]);

      const currentRecords  = extractRecords(currentRaw);
      const baselineRecords = extractRecords(baselineRaw);

      for (const [svc, amount] of groupByService(currentRecords)) {
        const existing = currentByService.get(svc);
        currentByService.set(svc, {
          amount: (existing?.amount ?? 0) + amount,
          provider,
        });
      }
      for (const [svc, amount] of groupByService(baselineRecords)) {
        const existing = baselineByService.get(svc);
        baselineByService.set(svc, {
          amount: (existing?.amount ?? 0) + amount,
          provider,
        });
      }
    }

    // ── Compute deltas across all services ───────────────────────────────────
    const allServices = new Set([...currentByService.keys(), ...baselineByService.keys()]);
    const anomalies: AnomalyRecord[] = [];

    const currentDays  = daysBetween(input.currentPeriodStart, input.currentPeriodEnd);
    const isPartialMonth = currentDays < 28;

    let totalCurrent  = 0;
    let totalBaseline = 0;

    for (const svc of allServices) {
      const current  = currentByService.get(svc)?.amount  ?? 0;
      const baseline = baselineByService.get(svc)?.amount ?? 0;
      const provider = (currentByService.get(svc) ?? baselineByService.get(svc))!.provider;

      totalCurrent  += current;
      totalBaseline += baseline;

      if (baseline === 0 && current === 0) continue;

      const delta = current - baseline;
      const deltaPercent = baseline === 0
        ? (current > 0 ? 100 : 0)   // new service appearing counts as 100% increase
        : (delta / baseline) * 100;

      // Only surface increases above threshold
      if (deltaPercent <= threshold) continue;

      const severity: AnomalySeverity = deltaPercent > 100 ? "critical" : "warning";

      const anomaly: AnomalyRecord = {
        serviceName: svc,
        provider,
        currentSpend:  current.toFixed(2),
        baselineSpend: baseline.toFixed(2),
        deltaPercent:  Number(deltaPercent.toFixed(2)),
        deltaAmount:   delta.toFixed(2),
        severity,
        recommendation: buildRecommendation(svc, deltaPercent, delta, severity),
      };

      // Projected monthly overage for partial-period comparisons
      if (isPartialMonth && currentDays > 0) {
        const dailyDelta = delta / currentDays;
        const projectedOverage = dailyDelta * 30;
        if (projectedOverage > 0) {
          anomaly.projectedMonthlyOverage = projectedOverage.toFixed(2);
        }
      }

      anomalies.push(anomaly);
    }

    // ── Rank by deltaAmount DESC ──────────────────────────────────────────────
    anomalies.sort((a, b) => parseFloat(b.deltaAmount) - parseFloat(a.deltaAmount));

    // ── Overall severity ──────────────────────────────────────────────────────
    let overallSeverity: OverallSeverity = "none";
    if (anomalies.some((a) => a.severity === "critical")) overallSeverity = "critical";
    else if (anomalies.length > 0) overallSeverity = "warning";

    const totalDelta = totalCurrent - totalBaseline;
    const totalDeltaPercent = totalBaseline === 0
      ? 0
      : Number(((totalDelta / totalBaseline) * 100).toFixed(2));

    // ── Determine composite ingest mode ───────────────────────────────────────
    let ingestMode: "deterministic" | "live" | "mixed";
    if (ingestModes.size === 0 || (ingestModes.has("deterministic") && !ingestModes.has("live"))) {
      ingestMode = "deterministic";
    } else if (ingestModes.has("live") && !ingestModes.has("deterministic")) {
      ingestMode = "live";
    } else {
      ingestMode = "mixed";
    }

    const output: BillingAnomalyOutput = {
      anomalies,
      totalCurrentSpend:  totalCurrent.toFixed(2),
      totalBaselineSpend: totalBaseline.toFixed(2),
      totalDeltaPercent,
      overallSeverity,
      currentPeriod:  { start: input.currentPeriodStart,  end: input.currentPeriodEnd },
      baselinePeriod: { start: input.baselinePeriodStart, end: input.baselinePeriodEnd },
      providersCovered: providers,
      anomalyCount: anomalies.length,
      thresholdPercent: threshold,
      ingestMode,
    };

    const warnings: string[] = [
      `Anomaly detection compares ${input.currentPeriodStart}→${input.currentPeriodEnd} ` +
      `against baseline ${input.baselinePeriodStart}→${input.baselinePeriodEnd}. ` +
      `Records carry dataCompleteness: "partial" — Phase 10 native adapters will produce "complete" records.`,
    ];
    if (isPartialMonth) {
      warnings.push(
        `Current period is ${currentDays} days (< 28). ` +
        `projectedMonthlyOverage is extrapolated at a constant daily rate — ` +
        `treat as directional estimate only.`,
      );
    }

    const result: McpToolResult<BillingAnomalyOutput> = {
      output,
      toolId: billingAnomalyDetectTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.anomaly.threshold.relative-delta.v1",
        "billing.anomaly.severity.2x-critical",
        `billing.anomaly.ingest.${ingestMode}`,
      ],
    };

    return result;
  },
};
