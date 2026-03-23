// ─── billing.chargeback.allocate — MCP tool ───────────────────────────────────
//
// Distributes shared costs across consumer entities using a configurable
// allocation method, returning per-consumer charge records aligned to the
// FOCUS 1.3 Allocation columns.
//
// FOCUS 1.3 Allocation columns covered:
//   AllocatedCost, AllocatedMethodID, AllocatedMethodDetails,
//   AllocatedResourceID, AllocatedResourceName, AllocatedTags
//
// Tool id:   billing.chargeback.allocate
// Namespace: billing
// Stability: beta
//
// Phase 9 — deterministic mode only; live ingestion deferred to Phase 10.
//
// ─── Allocation methods ────────────────────────────────────────────────────────
//
//   even        : Split equally among all consumers.
//   proportional: Split by consumer weight (relative weight / sum of weights).
//   tag-based   : Consumers are identified by tag key; equal share per consumer.
//
// ─── Fixture data ──────────────────────────────────────────────────────────────
//
// AWS:
//   k8s-cluster-prod  — $4800  — 3 consumers (platform 50%, ml 30%, data 20%)
//   nat-gateway-us-east-1 — $380 — 2 consumers (backend 60%, analytics 40%)
// GCP:
//   gke-cluster-prod  — $5200  — 3 consumers (engineering 55%, product 25%, ops 20%)
// Azure:
//   aks-cluster-prod  — $3900  — 3 consumers (dev 45%, ops 35%, qa 20%)

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Allocation types
// ---------------------------------------------------------------------------

/** Allocation method identifier — maps to FOCUS 1.3 AllocatedMethodID. */
export type AllocationMethodId = "even" | "proportional" | "tag-based";

/**
 * A single consumer allocation record — one row per consumer in the output.
 * Fields align to FOCUS 1.3 Allocation column set.
 */
export interface AllocationRecord {
  /** FOCUS 1.3: AllocatedResourceID — the shared resource being allocated. */
  allocatedResourceId: string;

  /** FOCUS 1.3: AllocatedResourceName — human-readable resource name. */
  allocatedResourceName: string;

  /** Consumer entity receiving this allocated charge. */
  consumerId: string;

  /** Human-readable consumer display name. */
  consumerName: string;

  /** FOCUS 1.3: AllocatedMethodID — method used to split the shared cost. */
  allocatedMethodId: AllocationMethodId;

  /**
   * FOCUS 1.3: AllocatedMethodDetails — prose description of the exact
   * allocation rule applied, sufficient to reproduce the split.
   */
  allocatedMethodDetails: string;

  /** FOCUS 1.3: AllocatedCost — this consumer's share of the shared cost. */
  allocatedCost: number;

  /** Fraction of total cost assigned to this consumer (0–1). */
  allocationFraction: number;

  /** Total shared cost that was distributed (same for all records in a response). */
  totalSharedCost: number;

  /** Currency for all monetary fields. */
  currency: string;

  /** FOCUS 1.3: AllocatedTags — tags that identify or qualify this consumer. */
  allocatedTags: Record<string, string>;

  /** Start of the billing period this allocation covers. */
  periodStart: string;

  /** End of the billing period this allocation covers. */
  periodEnd: string;
}

/** Summary of the allocation run. */
export interface AllocationSummary {
  /** Total shared cost distributed. */
  totalSharedCost: number;

  /** Total allocated cost (should equal totalSharedCost after rounding correction). */
  totalAllocatedCost: number;

  /** Number of consumer records produced. */
  consumerCount: number;

  /** Any rounding residual applied to the last consumer (decimal cents). */
  roundingResidue: number;

  /** Allocation method used. */
  allocationMethod: AllocationMethodId;

  /** Currency. */
  currency: string;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingChargebackAllocateInput {
  /** Cloud provider. Currently: "aws" | "gcp" | "azure". */
  provider: string;

  /** ISO 8601 date — start of billing period. */
  periodStart: string;

  /** ISO 8601 date — end of billing period. */
  periodEnd: string;

  /**
   * Allocation method to apply.
   * - "even"          : Equal share for each consumer.
   * - "proportional"  : Weighted share (consumers must have weights defined in fixture).
   * - "tag-based"     : Identify consumers by resource tags.
   * Default: "proportional".
   */
  allocationMethod?: AllocationMethodId;

  /**
   * Optional: filter allocation to a specific shared resource ID.
   * If omitted, all shared resources for the provider+period are returned.
   */
  resourceId?: string;
}

export interface BillingChargebackAllocateOutput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  allocationMethod: AllocationMethodId;
  allocations: AllocationRecord[];
  summary: AllocationSummary;
  ingestMode: "deterministic";
  fixtureVersion: string;
}

// ---------------------------------------------------------------------------
// Allocation adapter registry (future live-mode extensibility)
// ---------------------------------------------------------------------------

export interface ChargebackAdapterRegistry {
  load(provider: string, periodStart: string, periodEnd: string): Promise<BillingChargebackAllocateOutput>;
}

let _chargebackRegistry: ChargebackAdapterRegistry | null = null;

export function setChargebackBillingRegistry(registry: ChargebackAdapterRegistry): void {
  _chargebackRegistry = registry;
}

export function _resetChargebackBillingRegistry(): void {
  _chargebackRegistry = null;
}

// ---------------------------------------------------------------------------
// Built-in fixtures
// ---------------------------------------------------------------------------

interface ConsumerDef {
  id: string;
  name: string;
  weight: number;
  tags: Record<string, string>;
}

interface SharedResourceFixture {
  resourceId: string;
  resourceName: string;
  totalCost: number;
  currency: string;
  consumers: ConsumerDef[];
}

interface ProviderFixture {
  version: string;
  resources: SharedResourceFixture[];
}

const FIXTURES: Record<string, ProviderFixture> = {
  aws: {
    version: "1.0.0",
    resources: [
      {
        resourceId: "k8s-cluster-prod",
        resourceName: "Production Kubernetes Cluster (EKS)",
        totalCost: 4800,
        currency: "USD",
        consumers: [
          { id: "platform-team", name: "Platform Team",    weight: 0.5, tags: { team: "platform",  env: "prod" } },
          { id: "ml-team",       name: "ML / AI Team",     weight: 0.3, tags: { team: "ml",        env: "prod" } },
          { id: "data-team",     name: "Data Engineering", weight: 0.2, tags: { team: "data",      env: "prod" } },
        ],
      },
      {
        resourceId: "nat-gateway-us-east-1",
        resourceName: "Shared NAT Gateway (us-east-1)",
        totalCost: 380,
        currency: "USD",
        consumers: [
          { id: "backend-svc",   name: "Backend Service",   weight: 0.6, tags: { service: "backend",   env: "prod" } },
          { id: "analytics-svc", name: "Analytics Service", weight: 0.4, tags: { service: "analytics", env: "prod" } },
        ],
      },
    ],
  },
  gcp: {
    version: "1.0.0",
    resources: [
      {
        resourceId: "gke-cluster-prod",
        resourceName: "Production GKE Cluster",
        totalCost: 5200,
        currency: "USD",
        consumers: [
          { id: "engineering", name: "Engineering",    weight: 0.55, tags: { department: "engineering", env: "prod" } },
          { id: "product",     name: "Product",        weight: 0.25, tags: { department: "product",     env: "prod" } },
          { id: "operations",  name: "Operations",     weight: 0.20, tags: { department: "operations",  env: "prod" } },
        ],
      },
    ],
  },
  azure: {
    version: "1.0.0",
    resources: [
      {
        resourceId: "aks-cluster-prod",
        resourceName: "Production AKS Cluster",
        totalCost: 3900,
        currency: "USD",
        consumers: [
          { id: "dev-team", name: "Development Team", weight: 0.45, tags: { team: "dev", costcenter: "CC-001" } },
          { id: "ops-team", name: "Operations Team",  weight: 0.35, tags: { team: "ops", costcenter: "CC-002" } },
          { id: "qa-team",  name: "QA Team",          weight: 0.20, tags: { team: "qa",  costcenter: "CC-003" } },
        ],
      },
    ],
  },
};

const SUPPORTED_PROVIDERS = Object.keys(FIXTURES);
const FIXTURE_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Allocation engine
// ---------------------------------------------------------------------------

function buildMethodDetails(
  method: AllocationMethodId,
  consumers: ConsumerDef[],
  totalCost: number,
): string {
  switch (method) {
    case "even": {
      const share = (totalCost / consumers.length).toFixed(2);
      return `Even split: ${totalCost} ÷ ${consumers.length} consumers = ${share} each.`;
    }
    case "proportional": {
      const parts = consumers
        .map((c) => `${c.id} (weight=${c.weight.toFixed(2)})`)
        .join(", ");
      return `Proportional split by weight. Consumers: ${parts}. Weights normalised to sum=1.`;
    }
    case "tag-based": {
      const tagKey = Object.keys(consumers[0]?.tags ?? {})[0] ?? "team";
      return `Tag-based split: consumers identified by tag key "${tagKey}". Equal share per distinct tag value.`;
    }
  }
}

function computeFractions(method: AllocationMethodId, consumers: ConsumerDef[]): number[] {
  switch (method) {
    case "even":
    case "tag-based": {
      const share = 1 / consumers.length;
      return consumers.map(() => share);
    }
    case "proportional": {
      const total = consumers.reduce((s, c) => s + c.weight, 0);
      return consumers.map((c) => c.weight / total);
    }
  }
}

function buildAllocations(
  resource: SharedResourceFixture,
  method: AllocationMethodId,
  periodStart: string,
  periodEnd: string,
): AllocationRecord[] {
  const fractions = computeFractions(method, resource.consumers);
  const methodDetails = buildMethodDetails(method, resource.consumers, resource.totalCost);
  const records: AllocationRecord[] = [];
  let sumAllocated = 0;

  resource.consumers.forEach((consumer, i) => {
    const isLast = i === resource.consumers.length - 1;
    const fraction = fractions[i]!;
    // Apply rounding correction to last consumer to ensure sum = totalCost exactly
    const allocatedCost = isLast
      ? parseFloat((resource.totalCost - sumAllocated).toFixed(2))
      : parseFloat((resource.totalCost * fraction).toFixed(2));

    sumAllocated += allocatedCost;

    records.push({
      allocatedResourceId: resource.resourceId,
      allocatedResourceName: resource.resourceName,
      consumerId: consumer.id,
      consumerName: consumer.name,
      allocatedMethodId: method,
      allocatedMethodDetails: methodDetails,
      allocatedCost,
      allocationFraction: parseFloat(fraction.toFixed(6)),
      totalSharedCost: resource.totalCost,
      currency: resource.currency,
      allocatedTags: { ...consumer.tags },
      periodStart,
      periodEnd,
    });
  });

  return records;
}

function buildOutputSummary(
  allocations: AllocationRecord[],
  method: AllocationMethodId,
  currency: string,
): AllocationSummary {
  const totalSharedCost = allocations[0]?.totalSharedCost ?? 0;
  const totalAllocatedCost = parseFloat(
    allocations.reduce((s, a) => s + a.allocatedCost, 0).toFixed(2),
  );
  const roundingResidue = parseFloat((totalSharedCost - totalAllocatedCost).toFixed(6));

  return {
    totalSharedCost,
    totalAllocatedCost,
    consumerCount: allocations.length,
    roundingResidue,
    allocationMethod: method,
    currency,
  };
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingChargebackAllocateTool: McpToolDescriptor<
  BillingChargebackAllocateInput,
  BillingChargebackAllocateOutput
> = {
  id: "billing.chargeback.allocate",
  name: "Billing Chargeback Allocate",
  description:
    "Distribute shared infrastructure costs across consumer entities using a configurable " +
    "allocation method. Returns per-consumer AllocationRecord rows aligned to FOCUS 1.3 " +
    "Allocation columns (AllocatedCost, AllocatedMethodID, AllocatedMethodDetails, " +
    "AllocatedResourceID, AllocatedResourceName, AllocatedTags). " +
    "Supports even, proportional (weighted), and tag-based allocation strategies.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["provider", "periodStart", "periodEnd"],
    properties: {
      provider: {
        type: "string",
        description: `Cloud provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
        enum: SUPPORTED_PROVIDERS,
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of billing period (e.g. '2026-01-01').",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of billing period (e.g. '2026-02-01').",
      },
      allocationMethod: {
        type: "string",
        description:
          "Allocation strategy: 'even' (equal share), 'proportional' (weighted), 'tag-based' (per-tag identity). Default: 'proportional'.",
        enum: ["even", "proportional", "tag-based"],
      },
      resourceId: {
        type: "string",
        description:
          "Optional: filter to a specific shared resource ID. Omit to return all shared resources.",
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingChargebackAllocateOutput>> => {
    const { input, context } = envelope;

    // ── Live adapter path ────────────────────────────────────────────────────
    if (_chargebackRegistry !== null) {
      const output = await _chargebackRegistry.load(
        input.provider,
        input.periodStart,
        input.periodEnd,
      );
      return buildResult(output, output.fixtureVersion, context.requestId);
    }

    // ── Input validation ─────────────────────────────────────────────────────
    const fixture = FIXTURES[input.provider];
    if (!fixture) {
      throw Object.assign(
        new Error(
          `Provider '${input.provider}' is not supported. ` +
          `Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`
        ),
        { code: "UNKNOWN_PROVIDER" }
      );
    }

    const method: AllocationMethodId = input.allocationMethod ?? "proportional";
    const validMethods: AllocationMethodId[] = ["even", "proportional", "tag-based"];
    if (!validMethods.includes(method)) {
      throw Object.assign(
        new Error(`'allocationMethod' must be one of: ${validMethods.join(", ")}.`),
        { code: "INVALID_METHOD" }
      );
    }

    // ── Filter resources ──────────────────────────────────────────────────────
    let resources = fixture.resources;
    if (input.resourceId) {
      resources = resources.filter((r) => r.resourceId === input.resourceId);
      if (resources.length === 0) {
        throw Object.assign(
          new Error(
            `No shared resource found with id '${input.resourceId}' ` +
            `for provider '${input.provider}'.`
          ),
          { code: "RESOURCE_NOT_FOUND" }
        );
      }
    }

    // ── Build allocation records ──────────────────────────────────────────────
    const allAllocations: AllocationRecord[] = resources.flatMap((resource) =>
      buildAllocations(resource, method, input.periodStart, input.periodEnd),
    );

    const currency = resources[0]?.currency ?? "USD";
    const summary = buildOutputSummary(allAllocations, method, currency);

    const output: BillingChargebackAllocateOutput = {
      provider: input.provider,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      allocationMethod: method,
      allocations: allAllocations,
      summary,
      ingestMode: "deterministic",
      fixtureVersion: fixture.version,
    };

    return buildResult(output, fixture.version, context.requestId);
  },
};

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function buildResult(
  output: BillingChargebackAllocateOutput,
  fixtureVersion: string,
  requestId: string,
): McpToolResult<BillingChargebackAllocateOutput> {
  return {
    output,
    toolId: billingChargebackAllocateTool.id,
    executedAt: new Date().toISOString(),
    requestId,
    warnings: [
      `Allocation data is deterministic (fixture v${fixtureVersion}). ` +
      "Live provider billing ingestion available in Phase 10+.",
    ],
    appliedIds: [
      `billing.chargeback.${output.allocationMethod}`,
      "billing.chargeback.adapter.deterministic",
    ],
  };
}
