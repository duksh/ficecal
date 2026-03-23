// ─── billing.commitment.status — MCP tool ─────────────────────────────────────
//
// Returns the status of all commitment discounts (Reserved Instances, Savings
// Plans, Committed Use Discounts) for a given provider and billing period.
//
// Covers the FOCUS 1.3 CommitmentDiscount dataset (7 columns):
//   CommitmentDiscountCategory, CommitmentDiscountId, CommitmentDiscountName,
//   CommitmentDiscountStatus, CommitmentDiscountType,
//   CommitmentDiscountQuantity, CommitmentDiscountUnit
//
// Tool id: billing.commitment.status
// Namespace: billing
// Stability: beta
//
// Phase 8 — deterministic mode uses fixture data.
// Live mode (Phase 9+) will call provider commitment APIs.

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// FOCUS 1.3 CommitmentDiscount types
// ---------------------------------------------------------------------------

/** FOCUS 1.3: CommitmentDiscountCategory */
export type CommitmentDiscountCategory = "spend" | "usage";

/** FOCUS 1.3: CommitmentDiscountStatus */
export type CommitmentDiscountStatus = "used" | "unused";

/**
 * A single commitment discount record following FOCUS 1.3 CommitmentDiscount columns.
 */
export interface CommitmentStatusRecord {
  /** FOCUS 1.3: CommitmentDiscountId — provider-issued commitment identifier. */
  commitmentDiscountId: string;

  /** FOCUS 1.3: CommitmentDiscountName — human-readable commitment name. */
  commitmentDiscountName?: string;

  /** FOCUS 1.3: CommitmentDiscountCategory — "spend" or "usage". */
  commitmentDiscountCategory: CommitmentDiscountCategory;

  /** FOCUS 1.3: CommitmentDiscountType — provider label (e.g. "Savings Plans"). */
  commitmentDiscountType: string;

  /** FOCUS 1.3: CommitmentDiscountStatus — "used" or "unused". */
  commitmentDiscountStatus: CommitmentDiscountStatus;

  /**
   * FOCUS 1.3: CommitmentDiscountQuantity — consumed or wasted amount.
   * For spend-based: monetary value. For usage-based: usage quantity.
   */
  commitmentDiscountQuantity: number;

  /** FOCUS 1.3: CommitmentDiscountUnit — unit for commitmentDiscountQuantity. */
  commitmentDiscountUnit: string;

  /** Effective cost covered by this commitment in the period. */
  effectiveCost: number;

  /** List cost equivalent (what the same usage would cost on-demand). */
  listCost: number;

  /** Net savings: listCost - effectiveCost. Negative = wasted spend. */
  netSavings: number;

  /** Currency for all monetary fields. */
  currency: string;

  /** Start of the period this record covers. */
  periodStart: string;

  /** End of the period this record covers. */
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingCommitmentStatusInput {
  /** Cloud provider: "aws" | "gcp" | "azure" */
  provider: string;

  /** Billing period start (ISO date "YYYY-MM-DD"). */
  periodStart: string;

  /** Billing period end (ISO date "YYYY-MM-DD"). */
  periodEnd: string;

  /**
   * Filter by commitment status.
   * - "used"   : Only show commitments that were consumed
   * - "unused" : Only show commitments that went unused (wasted spend)
   * - omitted  : Show all
   */
  filterStatus?: CommitmentDiscountStatus;

  /**
   * Filter by commitment type (e.g. "Savings Plans", "Reserved Instance").
   * Case-insensitive substring match.
   */
  filterType?: string;
}

export interface CommitmentSummary {
  /** Total number of commitment records in the period. */
  totalCount: number;

  /** Number of "used" commitment records. */
  usedCount: number;

  /** Number of "unused" (wasted) commitment records. */
  unusedCount: number;

  /** Total effective cost covered by all commitments (USD equivalent). */
  totalEffectiveCost: number;

  /** Total list cost equivalent for the same usage on-demand. */
  totalListCost: number;

  /** Total net savings: totalListCost - totalEffectiveCost. */
  totalNetSavings: number;

  /** Total wasted spend from unused commitments. */
  totalWastedSpend: number;

  /** Utilisation rate: usedCount / totalCount (0–1). null if totalCount = 0. */
  utilisationRate: number | null;
}

export interface BillingCommitmentStatusOutput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  currency: string;

  /** All commitment records matching the input filters. */
  commitments: CommitmentStatusRecord[];

  /** Aggregate summary across all commitments in the response. */
  summary: CommitmentSummary;

  ingestMode: "deterministic" | "live";
  fixtureVersion?: string;
}

// ---------------------------------------------------------------------------
// Adapter registry interface
// ---------------------------------------------------------------------------

/**
 * Registry interface for commitment adapters.
 * Separate from BillingAdapterRegistry to allow independent registration.
 */
export interface CommitmentAdapterRegistry {
  getAdapter(provider: string): {
    loadCommitments(start: string, end: string): Promise<unknown>;
    ingestMode?: "deterministic" | "live";
  } | undefined;

  getFixture(provider: string): { version: string } | undefined;
}

// ---------------------------------------------------------------------------
// Module-level registry (set by transport layer at startup)
// ---------------------------------------------------------------------------

let _commitmentRegistry: CommitmentAdapterRegistry | null = null;

export function setCommitmentBillingRegistry(registry: CommitmentAdapterRegistry): void {
  _commitmentRegistry = registry;
}

export function _resetCommitmentBillingRegistry(): void {
  _commitmentRegistry = null;
}

// ---------------------------------------------------------------------------
// Built-in deterministic fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal deterministic fixture data for providers that don't have a registered
 * commitment adapter. Used in Phase 8 for `aws` (Savings Plans + RI),
 * `gcp` (CUDs), and `azure` (Reserved Instances).
 */
const BUILT_IN_FIXTURES: Record<string, {
  version: string;
  currency: string;
  records: Omit<CommitmentStatusRecord, "periodStart" | "periodEnd">[];
}> = {
  aws: {
    version: "1.0.0",
    currency: "USD",
    records: [
      {
        commitmentDiscountId: "arn:aws:savingsplans::123456789012:savingsplan/sp-abc123def456",
        commitmentDiscountName: "ficecal-bedrock-compute-sp",
        commitmentDiscountCategory: "spend",
        commitmentDiscountType: "Savings Plans",
        commitmentDiscountStatus: "used",
        commitmentDiscountQuantity: 1200.00,
        commitmentDiscountUnit: "USD",
        effectiveCost: 1200.00,
        listCost: 1595.35,
        netSavings: 395.35,
        currency: "USD",
      },
      {
        commitmentDiscountId: "arn:aws:ec2:::reserved-instances/ri-0abc123def456789",
        commitmentDiscountName: "ficecal-api-ri-1yr",
        commitmentDiscountCategory: "usage",
        commitmentDiscountType: "Reserved Instance",
        commitmentDiscountStatus: "used",
        commitmentDiscountQuantity: 744,
        commitmentDiscountUnit: "Hrs",
        effectiveCost: 250.68,
        listCost: 501.36,
        netSavings: 250.68,
        currency: "USD",
      },
      {
        commitmentDiscountId: "arn:aws:savingsplans::123456789012:savingsplan/sp-unused99",
        commitmentDiscountName: "ficecal-ml-sp-unused",
        commitmentDiscountCategory: "spend",
        commitmentDiscountType: "Savings Plans",
        commitmentDiscountStatus: "unused",
        commitmentDiscountQuantity: 87.30,
        commitmentDiscountUnit: "USD",
        effectiveCost: 87.30,
        listCost: 87.30,
        netSavings: 0,
        currency: "USD",
      },
    ],
  },

  gcp: {
    version: "1.0.0",
    currency: "USD",
    records: [
      {
        commitmentDiscountId: "projects/ficecal-prod/commitments/cud-n2-cpu-1yr",
        commitmentDiscountName: "ficecal-n2-cpu-cud",
        commitmentDiscountCategory: "usage",
        commitmentDiscountType: "Committed Use Discount",
        commitmentDiscountStatus: "used",
        commitmentDiscountQuantity: 720,
        commitmentDiscountUnit: "vCPU-hr",
        effectiveCost: 144.00,
        listCost: 240.00,
        netSavings: 96.00,
        currency: "USD",
      },
      {
        commitmentDiscountId: "projects/ficecal-prod/commitments/cud-memory-1yr",
        commitmentDiscountName: "ficecal-memory-cud",
        commitmentDiscountCategory: "usage",
        commitmentDiscountType: "Committed Use Discount",
        commitmentDiscountStatus: "used",
        commitmentDiscountQuantity: 5760,
        commitmentDiscountUnit: "GB-hr",
        effectiveCost: 57.60,
        listCost: 96.00,
        netSavings: 38.40,
        currency: "USD",
      },
    ],
  },

  azure: {
    version: "1.0.0",
    currency: "USD",
    records: [
      {
        commitmentDiscountId: "/subscriptions/sub-1234/providers/Microsoft.Capacity/reservationOrders/order-abc/reservations/res-001",
        commitmentDiscountName: "ficecal-eastus-vm-ri",
        commitmentDiscountCategory: "usage",
        commitmentDiscountType: "Reserved Instance",
        commitmentDiscountStatus: "used",
        commitmentDiscountQuantity: 744,
        commitmentDiscountUnit: "Hrs",
        effectiveCost: 562.82,
        listCost: 879.72,
        netSavings: 316.90,
        currency: "USD",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummary(records: CommitmentStatusRecord[]): CommitmentSummary {
  const used = records.filter((r) => r.commitmentDiscountStatus === "used");
  const unused = records.filter((r) => r.commitmentDiscountStatus === "unused");

  const totalEffectiveCost = records.reduce((s, r) => s + r.effectiveCost, 0);
  const totalListCost = records.reduce((s, r) => s + r.listCost, 0);
  const totalNetSavings = records.reduce((s, r) => s + r.netSavings, 0);
  const totalWastedSpend = unused.reduce((s, r) => s + r.effectiveCost, 0);

  return {
    totalCount: records.length,
    usedCount: used.length,
    unusedCount: unused.length,
    totalEffectiveCost: round2(totalEffectiveCost),
    totalListCost: round2(totalListCost),
    totalNetSavings: round2(totalNetSavings),
    totalWastedSpend: round2(totalWastedSpend),
    utilisationRate:
      records.length === 0 ? null : round4(used.length / records.length),
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingCommitmentStatusTool: McpToolDescriptor<
  BillingCommitmentStatusInput,
  BillingCommitmentStatusOutput
> = {
  id: "billing.commitment.status",
  name: "Billing Commitment Status",
  description:
    "Retrieve the status of all commitment discounts (Reserved Instances, Savings Plans, " +
    "Committed Use Discounts) for a given cloud provider and billing period. " +
    "Covers the FOCUS 1.3 CommitmentDiscount dataset (7 columns). " +
    "Returns used vs unused commitment records and aggregate savings summary. " +
    "In deterministic mode (Phase 8), returns fixture data. " +
    "Live provider SDK calls are available in Phase 9+.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object",
    properties: {
      provider: {
        type: "string",
        description: "Cloud provider: aws | gcp | azure",
      },
      periodStart: {
        type: "string",
        description: "Billing period start date (YYYY-MM-DD)",
      },
      periodEnd: {
        type: "string",
        description: "Billing period end date (YYYY-MM-DD)",
      },
      filterStatus: {
        type: "string",
        enum: ["used", "unused"],
        description: "Filter results to only used or unused commitments",
      },
      filterType: {
        type: "string",
        description: "Filter by commitment type (case-insensitive substring match)",
      },
    },
    required: ["provider", "periodStart", "periodEnd"],
  },

  handler: async (envelope) => {
    const { input, context } = envelope;

    // ── Adapter path (registered commitment adapter takes priority) ───────────
    if (_commitmentRegistry !== null) {
      const adapter = _commitmentRegistry.getAdapter(input.provider);
      if (adapter) {
        const raw = await adapter.loadCommitments(input.periodStart, input.periodEnd);
        const records = (raw as CommitmentStatusRecord[]).map((r) => ({
          ...r,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        }));

        const filtered = applyFilters(records, input);
        const fixtureVersion = _commitmentRegistry.getFixture(input.provider)?.version;
        const adapterIngestMode = adapter.ingestMode ?? "deterministic";

        const output: BillingCommitmentStatusOutput = {
          provider: input.provider,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          currency: records[0]?.currency ?? "USD",
          commitments: filtered,
          summary: buildSummary(filtered),
          ingestMode: adapterIngestMode,
          ...(fixtureVersion !== undefined ? { fixtureVersion } : {}),
        };

        return buildResult(output, fixtureVersion, context.requestId);
      }
    }

    // ── Built-in deterministic fixture path ───────────────────────────────────
    const fixture = BUILT_IN_FIXTURES[input.provider];
    if (!fixture) {
      throw Object.assign(
        new Error(
          `No commitment adapter or built-in fixture for provider "${input.provider}". ` +
          `Supported: ${Object.keys(BUILT_IN_FIXTURES).join(", ")}.`
        ),
        { code: "PROVIDER_NOT_FOUND" }
      );
    }

    const records: CommitmentStatusRecord[] = fixture.records.map((r) => ({
      ...r,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    }));

    const filtered = applyFilters(records, input);

    const output: BillingCommitmentStatusOutput = {
      provider: input.provider,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: fixture.currency,
      commitments: filtered,
      summary: buildSummary(filtered),
      ingestMode: "deterministic",
      fixtureVersion: fixture.version,
    };

    return buildResult(output, fixture.version, context.requestId);
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applyFilters(
  records: CommitmentStatusRecord[],
  input: BillingCommitmentStatusInput
): CommitmentStatusRecord[] {
  let result = records;

  if (input.filterStatus) {
    result = result.filter((r) => r.commitmentDiscountStatus === input.filterStatus);
  }

  if (input.filterType) {
    const needle = input.filterType.toLowerCase();
    result = result.filter((r) =>
      r.commitmentDiscountType.toLowerCase().includes(needle)
    );
  }

  return result;
}

function buildResult(
  output: BillingCommitmentStatusOutput,
  fixtureVersion: string | undefined,
  requestId: string
): McpToolResult<BillingCommitmentStatusOutput> {
  return {
    output,
    toolId: billingCommitmentStatusTool.id,
    executedAt: new Date().toISOString(),
    requestId,
    warnings: fixtureVersion
      ? [
          `Commitment data is deterministic (fixture v${fixtureVersion}). ` +
          `Live provider commitment APIs available in Phase 9+.`,
        ]
      : [],
    appliedIds: [
      output.ingestMode === "live"
        ? "billing.commitment.adapter.live"
        : "billing.commitment.adapter.deterministic",
    ],
  };
}
