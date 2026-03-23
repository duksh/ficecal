// ─── normalize.ts — ProviderUsageRecord → NormalizedCostRecord ───────────────
//
// The shared cost-calculation and FOCUS normalization layer for all AI provider
// billing adapters. This is the central place where:
//
//   token counts (from provider usage APIs)
//   × per-token rates (from ficecal-model-lens via ModelPricingReference)
//   = NormalizedCostRecord v2 (FOCUS 1.3, dataCompleteness: "partial")
//
// Design rule: adapters NEVER calculate cost. They only fetch token counts.
// All pricing logic lives here, sourced from ficecal-model-lens.
//
// FOCUS fields populated:
//   recordId, sourceSystem, provider, providerRole, billingPeriodStart/End,
//   chargePeriodStart/End, currency, amount, amountType, billedCost,
//   effectiveCost, chargeCategory, chargeFrequency, pricingCategory,
//   serviceName, resourceId (canonical modelId), serviceCategory,
//   dataCompleteness, ingestedAt, schemaVersion
//
// FOCUS fields NOT populated (usage APIs don't provide them):
//   region, skuId, chargeDescription, billingAccountId, subAccountId,
//   resourceType, resourceName, tags — set to "partial"

import type { NormalizedCostRecord, ProviderRole } from "@ficecal/schemas/normalized-cost-record";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";
import type { ProviderUsageRecord } from "./interface.js";
import { lookupModelPricing } from "./model-lookup.js";

// ─── Normalization input ───────────────────────────────────────────────────────

export interface NormalizeOptions {
  providerId: string;
  displayName: string;         // e.g. "Anthropic API"
  pricingCatalog: ModelPricingReference[];
  billingPeriodStart: string;
  billingPeriodEnd: string;
  sourceSystem: string;        // e.g. "ficecal-billing-anthropic-deterministic"
  ingestedAt: string;          // ISO timestamp
}

// ─── Normalization result ──────────────────────────────────────────────────────

export interface NormalizeResult {
  records: NormalizedCostRecord[];
  /** Records where no ModelPricingReference was found — cost is $0, warning emitted. */
  unpricedModelIds: string[];
  warnings: string[];
}

// ─── Cost calculation ─────────────────────────────────────────────────────────
//
// ModelPricingReference.inputTokenCost is cost per 1M tokens
// (pricingUnit: "1M_tokens"). Formula:
//   cost = (tokens / 1_000_000) * ratePerMillion

function calcCost(
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number | undefined,
  pricing: ModelPricingReference,
): number {
  const inputCost  = (inputTokens  / 1_000_000) * (pricing.inputTokenCost  ?? 0);
  const outputCost = (outputTokens / 1_000_000) * (pricing.outputTokenCost ?? 0);
  const cachedCost =
    cachedInputTokens !== undefined && pricing.cachedInputTokenCost
      ? (cachedInputTokens / 1_000_000) * pricing.cachedInputTokenCost
      : 0;
  return inputCost + outputCost + cachedCost;
}

// ─── Provider role resolver ───────────────────────────────────────────────────

function resolveRole(providerId: string): ProviderRole {
  // Hyperscalers that host compute + serve models: "direct-provider"
  const directProviders = new Set(["aws", "gcp", "azure", "alibaba", "oci"]);
  return directProviders.has(providerId) ? "direct-provider" : "service-provider";
}

// ─── Record ID builder ────────────────────────────────────────────────────────

function buildRecordId(
  providerId: string,
  modelId: string,
  periodStart: string,
  periodEnd: string,
): string {
  return [providerId, modelId.replace(/\s+/g, "_"), periodStart, periodEnd].join(":");
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

/**
 * Convert an array of ProviderUsageRecord (raw token counts) into
 * NormalizedCostRecord[] (FOCUS 1.3) using model-lens pricing catalog.
 *
 * One ProviderUsageRecord → one NormalizedCostRecord.
 * If pricing not found: record emitted with amount "0.0000000000" and warning.
 */
export function normalizeUsageRecords(
  usageRecords: ProviderUsageRecord[],
  options: NormalizeOptions,
): NormalizeResult {
  const {
    providerId,
    displayName,
    pricingCatalog,
    billingPeriodStart,
    billingPeriodEnd,
    sourceSystem,
    ingestedAt,
  } = options;

  const records: NormalizedCostRecord[] = [];
  const unpricedModelIds: string[] = [];
  const warnings: string[] = [];

  const providerRole = resolveRole(providerId);

  for (const usage of usageRecords) {
    const pricing = lookupModelPricing(usage.modelId, providerId, pricingCatalog);

    let amountNum = 0;
    let canonicalModelId = usage.modelId;
    let pricingSourceNote: string | undefined;

    if (pricing !== null) {
      amountNum        = calcCost(usage.inputTokens, usage.outputTokens, usage.cachedInputTokens, pricing);
      canonicalModelId = pricing.modelId;
      pricingSourceNote = pricing.pricingSourceType === "hardcoded"
        ? `price from hardcoded catalog (verified ${pricing.priceVerifiedAt ?? "unknown"})`
        : `price from dynamic scrape (model-lens sourceVersion: ${pricing.sourceVersion})`;
    } else {
      unpricedModelIds.push(usage.modelId);
      warnings.push(
        `No ModelPricingReference found for model "${usage.modelId}" (provider: ${providerId}). ` +
        `Record emitted with amount: "0.0000000000". ` +
        `Update ficecal-model-lens catalog to include this model.`,
      );
    }

    const amountStr  = amountNum.toFixed(10);
    const currency   = usage.currency ?? "USD";

    const record: NormalizedCostRecord = {
      // ── Identity ─────────────────────────────────────────────────────────
      recordId: buildRecordId(providerId, usage.modelId, usage.periodStart, usage.periodEnd),
      sourceSystem,

      // ── Provider ─────────────────────────────────────────────────────────
      provider: providerId,
      providerRole,
      ...(usage.organizationId !== undefined
        ? { providerAccountId: usage.organizationId, billingAccountId: usage.organizationId }
        : {}),

      // ── Billing period ───────────────────────────────────────────────────
      billingPeriodStart,
      billingPeriodEnd,
      chargePeriodStart: usage.periodStart,
      chargePeriodEnd:   usage.periodEnd,

      // ── Charge detail ────────────────────────────────────────────────────
      chargeCategory:  "usage",
      chargeFrequency: "usage-based",

      // ── Monetary ─────────────────────────────────────────────────────────
      currency,
      amount:        amountStr,
      amountType:    "actual",
      billedCost:    amountStr,
      effectiveCost: amountStr,

      // ── Pricing ──────────────────────────────────────────────────────────
      pricingCategory: "standard",   // usage-API adapters: on-demand = FOCUS "standard"

      // ── Service ──────────────────────────────────────────────────────────
      serviceName:     `${displayName}`,
      serviceCategory: "AI and Machine Learning",
      // Resource = the specific model being called
      resourceId:   canonicalModelId,
      resourceType: "foundation-model",

      // ── Data quality ─────────────────────────────────────────────────────
      // "partial": usage APIs don't provide region, SKU, full billing detail.
      // Phase 11 native billing-export adapters may produce "complete".
      dataCompleteness: "partial",
      ingestedAt,
      schemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,
    };

    // Attach pricing source note as chargeDescription (informational)
    if (pricingSourceNote !== undefined) {
      (record as NormalizedCostRecord & { chargeDescription?: string }).chargeDescription =
        pricingSourceNote;
    }

    records.push(record);
  }

  return { records, unpricedModelIds, warnings };
}
