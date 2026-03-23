// ─── OpenOps → NormalizedCostRecord Adapter ────────────────────────────────────

import { randomUUID } from "node:crypto";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";
import type { OpenOpsCostRecord, OpenOpsAdapterOptions } from "./types.js";

/**
 * Normalise a single OpenOps cost record into a NormalizedCostRecord.
 *
 * Field mapping:
 *   record.service          → serviceName
 *   record.resource_id      → resourceId
 *   record.resource_name    → resourceName
 *   record.amount           → billedCost (string, toFixed(6)) + amount
 *   record.currency         → billingCurrency + currency
 *   record.start_date       → servicePeriodStart + billingPeriodStart + chargePeriodStart
 *   record.end_date         → servicePeriodEnd + billingPeriodEnd + chargePeriodEnd
 *   record.tags             → tags
 *   record.provider         → provider (falls back to options.defaultProvider ?? "unknown")
 *   record.account_id       → providerAccountId
 *   record.region           → region
 */
export function normalizeOpenOpsRecord(
  record: OpenOpsCostRecord,
  options?: OpenOpsAdapterOptions,
): NormalizedCostRecord {
  const billedCostNum =
    typeof record.amount === "string"
      ? parseFloat(record.amount)
      : record.amount;

  const billedCostStr = billedCostNum.toFixed(6);
  const providerId = record.provider ?? options?.defaultProvider ?? "unknown";
  const dataSource = options?.dataSource ?? "live";
  const now = new Date().toISOString();

  const normalized: NormalizedCostRecord = {
    // ── Identity ───────────────────────────────────────────────────────────
    recordId: record.id ?? randomUUID(),
    sourceSystem: "openops-cost-export",
    schemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,

    // ── Provider ───────────────────────────────────────────────────────────
    provider: providerId,
    providerRole: "direct-provider",
    ...(record.account_id !== undefined
      ? { providerAccountId: record.account_id }
      : {}),

    // ── Billing period (use start/end dates as the billing period) ─────────
    billingPeriodStart: record.start_date,
    billingPeriodEnd: record.end_date,
    chargePeriodStart: record.start_date,
    chargePeriodEnd: record.end_date,

    // ── Service period (FOCUS 1.3) ─────────────────────────────────────────
    servicePeriodStart: record.start_date,
    servicePeriodEnd: record.end_date,

    // ── Monetary ───────────────────────────────────────────────────────────
    currency: record.currency,
    billingCurrency: record.currency,
    amount: billedCostStr,
    amountType: "actual",
    billedCost: billedCostStr,

    // ── Service classification ─────────────────────────────────────────────
    serviceName: record.service,
    ...(record.resource_id !== undefined ? { resourceId: record.resource_id } : {}),
    ...(record.resource_name !== undefined ? { resourceName: record.resource_name } : {}),
    ...(record.region !== undefined ? { region: record.region } : {}),
    ...(record.usage_type !== undefined ? { usageUnit: record.usage_type } : {}),

    // ── Tags ───────────────────────────────────────────────────────────────
    ...(record.tags !== undefined ? { tags: record.tags } : {}),

    // ── Data quality ───────────────────────────────────────────────────────
    dataCompleteness: "partial",
    ingestedAt: now,

    // ── Data freshness (v2.2.0) ────────────────────────────────────────────
    dataRefreshedAt: now,
    dataFreshnessStatus: "fresh",
    dataSource,
  };

  return normalized;
}

/**
 * Normalise a batch of OpenOps cost records into NormalizedCostRecord[].
 */
export function normalizeOpenOpsBatch(
  records: OpenOpsCostRecord[],
  options?: OpenOpsAdapterOptions,
): NormalizedCostRecord[] {
  return records.map((record) => normalizeOpenOpsRecord(record, options));
}
