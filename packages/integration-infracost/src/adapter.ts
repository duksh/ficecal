// ─── Infracost → NormalizedCostRecord Adapter ──────────────────────────────────

import { randomUUID } from "node:crypto";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";
import type {
  InfracostCostComponent as _InfracostCostComponent,
  InfracostResource,
  InfracostProject,
  InfracostOutput,
  InfracostAdapterOptions,
} from "./types.js";

// ─── Provider derivation ──────────────────────────────────────────────────────

/**
 * Derive the cloud provider from the Terraform resource type prefix.
 *
 * - "aws_*"      → "aws"
 * - "google_*"   → "gcp"
 * - "azurerm_*"  → "azure"
 * - anything else → "unknown"
 */
function deriveProvider(resourceType: string): string {
  if (resourceType.startsWith("aws_")) return "aws";
  if (resourceType.startsWith("google_")) return "gcp";
  if (resourceType.startsWith("azurerm_")) return "azure";
  return "unknown";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns an ISO date string (YYYY-MM-DD) for today. */
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns an ISO date string (YYYY-MM-DD) for today + 30 days. */
function isoTodayPlus30(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Normalise a single Infracost resource into a NormalizedCostRecord.
 *
 * Field mapping:
 *   resource.resourceType → serviceName (provider resource type)
 *   resource.name         → resourceId (Terraform address)
 *   resource.monthlyCost  → billedCost + amount
 *   infracost.currency    → billingCurrency + currency
 *   resource.tags         → tags
 *   Derived from resourceType → provider
 *   ISO today             → servicePeriodStart / billingPeriodStart / chargePeriodStart
 *   ISO today+30d         → servicePeriodEnd / billingPeriodEnd / chargePeriodEnd
 *
 * Note: Infracost estimates are forward-looking CI cost forecasts, not actual
 * billing data. The chargeDescription field documents this distinction.
 */
export function normalizeInfracostResource(
  resource: InfracostResource,
  project: InfracostProject,
  infracost: InfracostOutput,
  options?: InfracostAdapterOptions,
): NormalizedCostRecord {
  const provider = deriveProvider(resource.resourceType);
  const dataSource = options?.dataSource ?? "live";
  const now = new Date().toISOString();
  const today = isoToday();
  const todayPlus30 = isoTodayPlus30();

  return {
    // ── Identity ─────────────────────────────────────────────────────────
    recordId: randomUUID(),
    sourceSystem: "infracost",
    schemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,

    // ── Provider ─────────────────────────────────────────────────────────
    provider,
    providerRole: "direct-provider",

    // ── Billing / service period (forecasted 30-day window) ───────────────
    billingPeriodStart: today,
    billingPeriodEnd: todayPlus30,
    chargePeriodStart: today,
    chargePeriodEnd: todayPlus30,
    servicePeriodStart: today,
    servicePeriodEnd: todayPlus30,

    // ── Monetary ─────────────────────────────────────────────────────────
    currency: infracost.currency,
    billingCurrency: infracost.currency,
    amount: resource.monthlyCost,
    amountType: "actual",
    billedCost: resource.monthlyCost,

    // ── Service classification ────────────────────────────────────────────
    serviceName: resource.resourceType,
    resourceId: resource.name,
    chargeDescription: `Infracost estimate — not actual billing data (project: ${project.name})`,

    // ── Tags ─────────────────────────────────────────────────────────────
    ...(resource.tags !== undefined && Object.keys(resource.tags).length > 0
      ? { tags: resource.tags }
      : {}),

    // ── Data quality ──────────────────────────────────────────────────────
    dataCompleteness: "partial",
    ingestedAt: now,

    // ── Data freshness (v2.2.0) ───────────────────────────────────────────
    dataRefreshedAt: now,
    dataFreshnessStatus: "fresh",
    dataSource,
  };
}

/**
 * Flatten all projects → resources in an InfracostOutput into NormalizedCostRecord[].
 */
export function normalizeInfracostOutput(
  infracost: InfracostOutput,
  options?: InfracostAdapterOptions,
): NormalizedCostRecord[] {
  const records: NormalizedCostRecord[] = [];
  for (const project of infracost.projects) {
    for (const resource of project.breakdown.resources) {
      records.push(normalizeInfracostResource(resource, project, infracost, options));
    }
  }
  return records;
}
