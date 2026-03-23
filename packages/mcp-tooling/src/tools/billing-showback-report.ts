// ─── billing.showback.report — MCP tool ───────────────────────────────────────
//
// Showback/Chargeback reporting — generates cost visibility reports grouped by
// team, project, cost-center, or environment. Aligned with the FinOps Framework
// 2026 Reporting/Alerting capability.
//
// Tool id:   billing.showback.report
// Namespace: billing
// Stability: beta

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShowbackRow {
  groupId: string;
  groupName: string;
  allocatedCost: number;
  percentOfTotal: number;
  currency: string;
  topServices: { serviceName: string; cost: number }[];
  tags: Record<string, string>;
  chargebackStatus?: "pending" | "approved" | "invoiced";
}

export interface ShowbackSummary {
  rowCount: number;
  coveredCost: number;
  uncoveredCost: number;
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingShowbackReportInput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  reportType?: "showback" | "chargeback";
  groupBy?: "team" | "project" | "cost-center" | "environment";
}

export interface BillingShowbackReportOutput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  reportType: "showback" | "chargeback";
  groupBy: string;
  totalCost: number;
  currency: string;
  rows: ShowbackRow[];
  summary: ShowbackSummary;
  ingestMode: "deterministic";
  fixtureVersion: string;
}

// ---------------------------------------------------------------------------
// Adapter registry
// ---------------------------------------------------------------------------

export interface ShowbackAdapterRegistry {
  load(
    provider: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<BillingShowbackReportOutput>;
}

let _showbackRegistry: ShowbackAdapterRegistry | null = null;

export function setShowbackBillingRegistry(registry: ShowbackAdapterRegistry): void {
  _showbackRegistry = registry;
}

export function _resetShowbackBillingRegistry(): void {
  _showbackRegistry = null;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_VERSION = "1.0.0";

interface GroupFixture {
  groupId: string;
  groupName: string;
  allocatedCost: number;
  tags: Record<string, string>;
  topServices: { serviceName: string; cost: number }[];
}

interface ProviderFixture {
  currency: string;
  untaggedCost: number;
  groups: GroupFixture[];
}

const FIXTURES: Record<string, ProviderFixture> = {
  aws: {
    currency: "USD",
    untaggedCost: 900,
    groups: [
      {
        groupId: "team-platform",
        groupName: "Platform",
        allocatedCost: 4200,
        tags: { team: "platform", env: "prod", costcenter: "CC-010" },
        topServices: [
          { serviceName: "Amazon EC2", cost: 2100 },
          { serviceName: "Amazon EKS", cost: 1400 },
          { serviceName: "Amazon RDS", cost: 700 },
        ],
      },
      {
        groupId: "team-ml",
        groupName: "ML / AI",
        allocatedCost: 6800,
        tags: { team: "ml", env: "prod", costcenter: "CC-020" },
        topServices: [
          { serviceName: "Amazon SageMaker", cost: 3800 },
          { serviceName: "Amazon EC2 (GPU)", cost: 2200 },
          { serviceName: "Amazon S3", cost: 800 },
        ],
      },
      {
        groupId: "team-data",
        groupName: "Data Engineering",
        allocatedCost: 2100,
        tags: { team: "data", env: "prod", costcenter: "CC-030" },
        topServices: [
          { serviceName: "Amazon Redshift", cost: 1100 },
          { serviceName: "AWS Glue", cost: 600 },
          { serviceName: "Amazon S3", cost: 400 },
        ],
      },
    ],
  },
  gcp: {
    currency: "USD",
    untaggedCost: 600,
    groups: [
      {
        groupId: "project-search",
        groupName: "Search",
        allocatedCost: 8400,
        tags: { project: "search", env: "prod", team: "search-infra" },
        topServices: [
          { serviceName: "Compute Engine", cost: 4200 },
          { serviceName: "Cloud Spanner", cost: 2800 },
          { serviceName: "Cloud Storage", cost: 1400 },
        ],
      },
      {
        groupId: "project-ads",
        groupName: "Ads Platform",
        allocatedCost: 12300,
        tags: { project: "ads", env: "prod", team: "ads-eng" },
        topServices: [
          { serviceName: "BigQuery", cost: 6100 },
          { serviceName: "Compute Engine", cost: 4800 },
          { serviceName: "Pub/Sub", cost: 1400 },
        ],
      },
      {
        groupId: "project-infra",
        groupName: "Infrastructure",
        allocatedCost: 3200,
        tags: { project: "infra", env: "prod", team: "platform-ops" },
        topServices: [
          { serviceName: "GKE", cost: 1800 },
          { serviceName: "Cloud SQL", cost: 900 },
          { serviceName: "Cloud Logging", cost: 500 },
        ],
      },
    ],
  },
  azure: {
    currency: "USD",
    untaggedCost: 400,
    groups: [
      {
        groupId: "cc-001",
        groupName: "CC-001",
        allocatedCost: 5100,
        tags: { costcenter: "CC-001", team: "dev", env: "prod" },
        topServices: [
          { serviceName: "Virtual Machines", cost: 2600 },
          { serviceName: "Azure SQL Database", cost: 1600 },
          { serviceName: "Azure Kubernetes Service", cost: 900 },
        ],
      },
      {
        groupId: "cc-002",
        groupName: "CC-002",
        allocatedCost: 3600,
        tags: { costcenter: "CC-002", team: "ops", env: "prod" },
        topServices: [
          { serviceName: "Virtual Machines", cost: 1800 },
          { serviceName: "Azure Monitor", cost: 1100 },
          { serviceName: "Azure Blob Storage", cost: 700 },
        ],
      },
      {
        groupId: "cc-003",
        groupName: "CC-003",
        allocatedCost: 1800,
        tags: { costcenter: "CC-003", team: "qa", env: "staging" },
        topServices: [
          { serviceName: "Virtual Machines", cost: 900 },
          { serviceName: "Azure DevOps", cost: 600 },
          { serviceName: "Azure Container Registry", cost: 300 },
        ],
      },
    ],
  },
};

const SUPPORTED_PROVIDERS = Object.keys(FIXTURES);

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingShowbackReportTool: McpToolDescriptor<
  BillingShowbackReportInput,
  BillingShowbackReportOutput
> = {
  id: "billing.showback.report",
  name: "Billing Showback / Chargeback Report",
  description:
    "Generates cost visibility reports grouped by team, project, cost-center, or environment. " +
    "Supports both showback (informational) and chargeback (invoiceable) modes. " +
    "Aligned with the FinOps Framework 2026 Reporting/Alerting capability.",
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
      reportType: {
        type: "string",
        description: "Report type: 'showback' (informational) or 'chargeback' (invoiceable). Default: 'showback'.",
        enum: ["showback", "chargeback"],
      },
      groupBy: {
        type: "string",
        description: "Dimension to group costs by. Default: 'team'.",
        enum: ["team", "project", "cost-center", "environment"],
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingShowbackReportOutput>> => {
    const { input, context } = envelope;

    // ── Live adapter path ──────────────────────────────────────────────────
    if (_showbackRegistry !== null) {
      const output = await _showbackRegistry.load(
        input.provider,
        input.periodStart,
        input.periodEnd,
      );
      return buildResult(output, context.requestId);
    }

    // ── Validation ─────────────────────────────────────────────────────────
    const fixture = FIXTURES[input.provider];
    if (!fixture) {
      throw Object.assign(
        new Error(
          `Provider '${input.provider}' is not supported. ` +
          `Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`,
        ),
        { code: "UNKNOWN_PROVIDER" },
      );
    }

    const reportType = input.reportType ?? "showback";
    const groupBy = input.groupBy ?? "team";

    // ── Build rows ─────────────────────────────────────────────────────────
    const totalGroupCost = fixture.groups.reduce((s, g) => s + g.allocatedCost, 0);
    const totalCost = totalGroupCost + fixture.untaggedCost;

    const rows: ShowbackRow[] = fixture.groups.map((g) => {
      const row: ShowbackRow = {
        groupId: g.groupId,
        groupName: g.groupName,
        allocatedCost: g.allocatedCost,
        percentOfTotal: parseFloat(((g.allocatedCost / totalCost) * 100).toFixed(2)),
        currency: fixture.currency,
        topServices: g.topServices,
        tags: g.tags,
      };
      if (reportType === "chargeback") {
        row.chargebackStatus = "approved";
      }
      return row;
    });

    const summary: ShowbackSummary = {
      rowCount: rows.length,
      coveredCost: totalGroupCost,
      uncoveredCost: fixture.untaggedCost,
      coveragePercent: parseFloat(((totalGroupCost / totalCost) * 100).toFixed(2)),
    };

    const output: BillingShowbackReportOutput = {
      provider: input.provider,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      reportType,
      groupBy,
      totalCost,
      currency: fixture.currency,
      rows,
      summary,
      ingestMode: "deterministic",
      fixtureVersion: FIXTURE_VERSION,
    };

    return buildResult(output, context.requestId);
  },
};

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function buildResult(
  output: BillingShowbackReportOutput,
  requestId: string,
): McpToolResult<BillingShowbackReportOutput> {
  return {
    output,
    toolId: billingShowbackReportTool.id,
    executedAt: new Date().toISOString(),
    requestId,
    warnings: [
      `Showback data is deterministic (fixture v${output.fixtureVersion}). ` +
      "Live provider billing ingestion available in a future release.",
    ],
    appliedIds: [
      "billing.showback.focus-aligned",
      "billing.showback.adapter.deterministic",
    ],
  };
}
