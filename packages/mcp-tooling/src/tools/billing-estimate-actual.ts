// ─── billing.estimate.actual — MCP tool ───────────────────────────────────────
//
// Retrieves FOCUS 1.3-normalised billing records from a registered billing
// adapter (deterministic mode: fixture data; live mode: AWS Cost Explorer).
//
// Tool id: billing.estimate.actual
// Namespace: billing
// Stability: beta
//
// ─── Phase 8B upgrade ─────────────────────────────────────────────────────────
//
// Output upgraded from BillingPeriodSummary (12 FOCUS columns) to
// NormalizedCostRecord[] (FOCUS 1.3, ~82% coverage, schemaVersion 2.0.0).
//
// A BillingPeriodSummary-to-NormalizedCostRecord mapper runs in the tool layer,
// bridging the Phase 9 adapter output format to the Phase 10 integration adapter
// target. Phase 10 adapters may return NormalizedCostRecord[] directly — the
// tool will detect that shape and pass it through without re-mapping.
//
// FOCUS mapping:
//   BillingLineItem.service  → NormalizedCostRecord.serviceName
//   BillingLineItem.sku      → NormalizedCostRecord.skuId
//   BillingLineItem.usageType→ NormalizedCostRecord.chargeDescription
//   BillingLineItem.cost     → NormalizedCostRecord.amount (decimal string)
//   BillingLineItem.currency → NormalizedCostRecord.currency
//   BillingLineItem.startDate→ NormalizedCostRecord.chargePeriodStart
//   BillingLineItem.endDate  → NormalizedCostRecord.chargePeriodEnd

import type { McpToolDescriptor, McpToolResult } from "../types.js";
import type { NormalizedCostRecord, ProviderRole } from "@ficecal/schemas/normalized-cost-record";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface BillingEstimateActualInput {
  provider: string;           // "aws" | "gcp" | "azure" | "openai"
  periodStart: string;        // ISO date "YYYY-MM-DD"
  periodEnd: string;          // ISO date "YYYY-MM-DD"
  currency?: string;          // ISO 4217 — defaults to provider's native currency
}

export interface BillingEstimateActualOutput {
  provider: string;
  accountId?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;

  /** Summary total across all records — convenience field for display. */
  totalCost: number;

  currency: string;

  /** Number of FOCUS 1.3 records in this response. */
  recordCount: number;

  /** FOCUS 1.3-normalised cost records (NormalizedCostRecord v2). */
  records: NormalizedCostRecord[];

  ingestMode: "deterministic" | "live";
  fixtureVersion?: string;

  /** FOCUS schema version used for the records array. Always "2.0.0". */
  focusSchemaVersion: string;
}

// ─── Registry interface ───────────────────────────────────────────────────────
//
// The tool accesses billing data through an injectable adapter registry.
// In production, this is supplied by the PluginHost's BillingRegistry.
// In tests, a mock is injected.

export interface BillingAdapterRegistry {
  getAdapter(
    provider: string,
  ): {
    load(start: string, end: string): Promise<unknown>;
    /** Declared ingest mode — "live" adapters call real provider SDKs. */
    ingestMode?: "deterministic" | "live";
  } | undefined;
  getFixture(provider: string): { version: string } | undefined;
}

// ─── Module-level registry (set by transport layer at startup) ─────────────────

let _billingRegistry: BillingAdapterRegistry | null = null;

export function setBillingRegistry(registry: BillingAdapterRegistry): void {
  _billingRegistry = registry;
}

export function _resetBillingRegistry(): void {
  _billingRegistry = null;
}

// ─── Provider role helper ──────────────────────────────────────────────────────
//
// Maps canonical provider name → FOCUS ProviderRole.
// Hyperscalers that both host and provide native services: "direct-provider".
// AI service providers (API-only, no compute hosting): "service-provider".

function resolveProviderRole(provider: string): ProviderRole {
  const directProviders = new Set(["aws", "gcp", "azure", "alibaba", "oci"]);
  if (directProviders.has(provider.toLowerCase())) return "direct-provider";
  return "service-provider"; // openai, anthropic, cohere, etc.
}

// ─── BillingPeriodSummary → NormalizedCostRecord[] mapper ─────────────────────
//
// Phase 9 adapters return BillingPeriodSummary (12 FOCUS-ish columns).
// This mapper bridges each BillingLineItem to a FOCUS 1.3 NormalizedCostRecord.
//
// Required NormalizedCostRecord fields populated:
//   recordId, sourceSystem, provider, providerRole,
//   billingPeriodStart, billingPeriodEnd,
//   chargePeriodStart, chargePeriodEnd,
//   currency, amount, amountType,
//   dataCompleteness, ingestedAt, schemaVersion
//
// Optional FOCUS fields populated where source data permits:
//   billingAccountId, serviceName, skuId, chargeDescription,
//   chargeCategory, chargeFrequency, billedCost, effectiveCost,
//   pricingCategory

type RawLineItem = {
  service: string;
  sku?: string;
  usageType?: string;
  cost: number;
  currency: string;
  startDate: string;
  endDate: string;
};

function mapLineItemToRecord(
  lineItem: RawLineItem,
  provider: string,
  accountId: string | undefined,
  billingPeriodStart: string,
  billingPeriodEnd: string,
  sourceSystem: string,
  ingestedAt: string,
): NormalizedCostRecord {
  const amountStr = lineItem.cost.toFixed(10);
  const recordId = [
    provider,
    lineItem.service.replace(/\s+/g, "_"),
    lineItem.sku ?? "default",
    lineItem.startDate,
    lineItem.endDate,
  ].join(":");

  return {
    // ── Identity ──────────────────────────────────────────────────────────
    recordId,
    sourceSystem,

    // ── Provider ──────────────────────────────────────────────────────────
    provider,
    providerRole: resolveProviderRole(provider),
    ...(accountId !== undefined ? { providerAccountId: accountId, billingAccountId: accountId } : {}),

    // ── Billing period ────────────────────────────────────────────────────
    billingPeriodStart,
    billingPeriodEnd,
    chargePeriodStart: lineItem.startDate,
    chargePeriodEnd: lineItem.endDate,

    // ── Charge detail ─────────────────────────────────────────────────────
    chargeCategory: "usage",
    chargeFrequency: "usage-based",
    ...(lineItem.usageType !== undefined ? { chargeDescription: lineItem.usageType } : {}),

    // ── Monetary ──────────────────────────────────────────────────────────
    currency: lineItem.currency,
    amount: amountStr,
    amountType: "actual",
    billedCost: amountStr,
    effectiveCost: amountStr,

    // ── Pricing ───────────────────────────────────────────────────────────
    pricingCategory: "standard",
    ...(lineItem.sku !== undefined ? { skuId: lineItem.sku } : {}),

    // ── Service ───────────────────────────────────────────────────────────
    serviceName: lineItem.service,

    // ── Data quality ──────────────────────────────────────────────────────
    // "partial" because BillingPeriodSummary covers ~12 of 77 FOCUS columns;
    // Phase 10 native adapters will produce "complete" records directly.
    dataCompleteness: "partial",
    ingestedAt,
    schemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,
  };
}

function billingPeriodSummaryToRecords(
  data: {
    provider: string;
    accountId?: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    lineItems: RawLineItem[];
  },
  sourceSystem: string,
  ingestedAt: string,
): NormalizedCostRecord[] {
  return data.lineItems.map((li) =>
    mapLineItemToRecord(
      li,
      data.provider,
      data.accountId,
      data.billingPeriodStart,
      data.billingPeriodEnd,
      sourceSystem,
      ingestedAt,
    ),
  );
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

export const billingEstimateActualTool: McpToolDescriptor<BillingEstimateActualInput, BillingEstimateActualOutput> = {
  id: "billing.estimate.actual",
  name: "Billing Estimate Actual",
  description:
    "Retrieve actual cloud billing data for a given provider and time period. " +
    "Returns FOCUS 1.3-normalised cost records (NormalizedCostRecord v2, ~82% FOCUS coverage) " +
    "plus a convenience summary total. " +
    "In deterministic mode returns fixture data; live mode calls the provider SDK directly. " +
    "Phase 8B: output upgraded from BillingPeriodSummary (12 FOCUS columns) to NormalizedCostRecord[].",
  namespace: "billing",
  stability: "beta",
  inputSchema: {
    type: "object",
    properties: {
      provider: { type: "string", description: "Cloud provider: aws | gcp | azure | openai" },
      periodStart: { type: "string", description: "Billing period start date (YYYY-MM-DD)" },
      periodEnd: { type: "string", description: "Billing period end date (YYYY-MM-DD)" },
      currency: { type: "string", description: "ISO 4217 currency code (optional, defaults to provider native)" },
    },
    required: ["provider", "periodStart", "periodEnd"],
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

    const adapterIngestMode = adapter.ingestMode ?? "deterministic";

    const raw = await adapter.load(input.periodStart, input.periodEnd).catch((err: unknown) => {
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === "LIVE_BILLING_NOT_IMPLEMENTED"
      ) {
        throw err;
      }
      throw err;
    });

    // ── Type-narrow the raw unknown from the adapter ───────────────────────────
    // Phase 9 adapters return BillingPeriodSummary shape.
    // Phase 10 adapters will return NormalizedCostRecord[] — detected via
    // Array.isArray check; if so, passed through without re-mapping.
    const ingestedAt = new Date().toISOString();
    const sourceSystem = `ficecal-billing-${input.provider}-${adapterIngestMode}`;

    let records: NormalizedCostRecord[];
    let totalCost: number;
    let currency: string;
    let billingPeriodStart: string;
    let billingPeriodEnd: string;
    let accountId: string | undefined;

    if (Array.isArray(raw)) {
      // Phase 10 native adapter: already NormalizedCostRecord[]
      records = raw as NormalizedCostRecord[];
      totalCost = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      currency = input.currency ?? (records[0]?.currency ?? "USD");
      billingPeriodStart = input.periodStart;
      billingPeriodEnd = input.periodEnd;
    } else {
      // Phase 9 adapter: BillingPeriodSummary shape — map to NormalizedCostRecord[]
      const data = raw as {
        provider: string;
        accountId?: string;
        billingPeriodStart: string;
        billingPeriodEnd: string;
        totalCost: number;
        currency: string;
        lineItems: RawLineItem[];
      };

      records = billingPeriodSummaryToRecords(data, sourceSystem, ingestedAt);
      totalCost = data.totalCost;
      currency = input.currency ?? data.currency;
      billingPeriodStart = data.billingPeriodStart;
      billingPeriodEnd = data.billingPeriodEnd;
      accountId = data.accountId;
    }

    const fixtureVersion = _billingRegistry.getFixture(input.provider)?.version;

    const output: BillingEstimateActualOutput = {
      provider: input.provider,
      ...(accountId !== undefined ? { accountId } : {}),
      billingPeriodStart,
      billingPeriodEnd,
      totalCost: Number(totalCost.toFixed(2)),
      currency,
      recordCount: records.length,
      records,
      ingestMode: adapterIngestMode,
      ...(fixtureVersion !== undefined ? { fixtureVersion } : {}),
      focusSchemaVersion: NORMALIZED_COST_RECORD_SCHEMA_VERSION,
    };

    const warnings: string[] = fixtureVersion
      ? [
          `Billing data is deterministic (fixture v${fixtureVersion}). ` +
          "Records carry dataCompleteness: \"partial\" — live adapters will produce \"complete\" records.",
        ]
      : [
          "Live billing records carry dataCompleteness: \"partial\" because BillingPeriodSummary " +
          "covers ~12 of 77 FOCUS 1.3 columns. Phase 10 native adapters will produce \"complete\" records.",
        ];

    const result: McpToolResult<BillingEstimateActualOutput> = {
      output,
      toolId: billingEstimateActualTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        adapterIngestMode === "live"
          ? "billing.adapter.live"
          : "billing.adapter.deterministic",
        "billing.focus.normalizer.v2",
        `billing.schema.${NORMALIZED_COST_RECORD_SCHEMA_VERSION}`,
      ],
    };

    return result;
  },
};
