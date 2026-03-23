// ─── AWS Billing Plugin ────────────────────────────────────────────────────────
//
// Phase 9: supports both deterministic (fixture) and live (Cost Explorer) ingest
// modes.
//
// Mode selection:
//   FICECAL_LIVE_BILLING=1  →  ingestMode: "live"
//                              Calls AWS Cost Explorer GetCostAndUsage API.
//                              Requires ambient AWS credentials (env, IMDS, etc).
//   (default)               →  ingestMode: "deterministic" (fixture data)
//
// Credentials (live mode):
//   Standard AWS credential chain — set via env vars, $HOME/.aws/credentials,
//   IMDS, or IAM role. Required IAM action: ce:GetCostAndUsage.
//
// The `live-billing` feature flag gates user-facing exposure of the live mode
// in the admin panel. The env var is the actual runtime switch for the adapter.

import type { FicecalPlugin, BillingPeriodSummary } from "@ficecal/plugin-api";
import type { BillingLineItem } from "@ficecal/plugin-api";
import awsFixture from "../../../../packages/schemas/fixtures/aws-billing-fixture.json" assert { type: "json" };

// Lazy-import the SDK types to avoid cold-start cost in deterministic mode
import type {
  CostExplorerClientConfig,
  GetCostAndUsageCommandInput,
  ResultByTime,
  Group,
} from "@aws-sdk/client-cost-explorer";

const data = awsFixture.data as BillingPeriodSummary;

// ─── Live mode detection ──────────────────────────────────────────────────────
//
// Evaluated once at module load — matches process.env read timing in services.
// In tests, set process.env.FICECAL_LIVE_BILLING = "1" before importing to
// activate live mode.  The _resetRegistry() helper in registry.ts also works
// since it re-imports the module each test run via vitest's module isolation.

const LIVE_MODE = process.env["FICECAL_LIVE_BILLING"] === "1";

// ─── AWS Cost Explorer → BillingPeriodSummary mapper ─────────────────────────

/**
 * Map one ResultByTime row from AWS GetCostAndUsage (GROUP_BY: SERVICE)
 * into a flat BillingLineItem array.
 *
 * GetCostAndUsage is called with:
 *   Granularity: MONTHLY
 *   Metrics: ["UnblendedCost"]
 *   GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
 *
 * Each Group looks like:
 *   { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "123.45", Unit: "USD" } } }
 */
function mapResultsToLineItems(
  results: ResultByTime[],
  periodStart: string,
  periodEnd: string,
): { lineItems: BillingLineItem[]; totalCost: number; currency: string } {
  const lineItems: BillingLineItem[] = [];
  let totalCost = 0;
  let currency = "USD";

  for (const row of results) {
    const start = row.TimePeriod?.Start ?? periodStart;
    const end = row.TimePeriod?.End ?? periodEnd;
    const groups: Group[] = row.Groups ?? [];

    for (const group of groups) {
      const service = group.Keys?.[0] ?? "Unknown";
      const metric = group.Metrics?.["UnblendedCost"];
      const amount = parseFloat(metric?.Amount ?? "0");
      currency = metric?.Unit ?? "USD";
      totalCost += amount;

      lineItems.push({
        service,
        sku: `${service}-UnblendedCost`,
        usageType: `${service}`,
        cost: parseFloat(amount.toFixed(10)),
        currency,
        startDate: start,
        endDate: end,
      });
    }

    // Handle un-grouped total rows (when no GROUP_BY is applied)
    if (groups.length === 0) {
      const metric = row.Total?.["UnblendedCost"];
      const amount = parseFloat(metric?.Amount ?? "0");
      currency = metric?.Unit ?? "USD";
      totalCost += amount;
      lineItems.push({
        service: "Total",
        sku: "Total-UnblendedCost",
        usageType: "Total",
        cost: parseFloat(amount.toFixed(10)),
        currency,
        startDate: start,
        endDate: end,
      });
    }
  }

  return { lineItems, totalCost: parseFloat(totalCost.toFixed(10)), currency };
}

// ─── Live adapter ─────────────────────────────────────────────────────────────

async function callCostExplorer(
  periodStart: string,
  periodEnd: string,
): Promise<BillingPeriodSummary> {
  // Dynamic import: only pulls in the SDK in live mode — no dead-weight in
  // the deterministic build path.
  const {
    CostExplorerClient,
    GetCostAndUsageCommand,
  } = await import("@aws-sdk/client-cost-explorer");

  const region =
    (process.env["AWS_REGION"] as string | undefined) ??
    (process.env["AWS_DEFAULT_REGION"] as string | undefined) ??
    "us-east-1";

  const clientConfig: CostExplorerClientConfig = { region };
  const client = new CostExplorerClient(clientConfig);

  const params: GetCostAndUsageCommandInput = {
    TimePeriod: {
      Start: periodStart,
      End: periodEnd,
    },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    GroupBy: [
      {
        Type: "DIMENSION",
        Key: "SERVICE",
      },
    ],
  };

  const command = new GetCostAndUsageCommand(params);
  const response = await client.send(command);

  const results: ResultByTime[] = response.ResultsByTime ?? [];
  const { lineItems, totalCost, currency } = mapResultsToLineItems(
    results,
    periodStart,
    periodEnd,
  );

  // Best-effort account ID from env (STS call would add latency)
  const accountId =
    (process.env["AWS_ACCOUNT_ID"] as string | undefined) ?? undefined;

  return {
    provider: "aws",
    ...(accountId !== undefined ? { accountId } : {}),
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    totalCost,
    currency,
    lineItems,
    metadata: {
      source: "aws-cost-explorer",
      granularity: "MONTHLY",
      metric: "UnblendedCost",
      region,
    },
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const awsBillingPlugin: FicecalPlugin = {
  id: "@ficecal/billing-aws",
  name: "AWS Billing Adapter",
  version: "2.0.0", // bumped for Phase 9 live Cost Explorer integration
  description: LIVE_MODE
    ? "AWS billing adapter — live mode. " +
      "Calls AWS Cost Explorer GetCostAndUsage (UnblendedCost, monthly, by SERVICE). " +
      "Requires ambient AWS credentials with ce:GetCostAndUsage IAM permission."
    : "AWS billing adapter — deterministic mode. " +
      "Returns Cost Explorer fixture data. Set FICECAL_LIVE_BILLING=1 for live mode.",
  contributions: {
    // Fixtures only in deterministic mode — live mode has no fixture to version-pin against
    ...(!LIVE_MODE
      ? {
          billingFixtures: [
            {
              provider: "aws",
              version: awsFixture.version,
              rawFormat: "cost-explorer" as const,
              data,
            },
          ],
        }
      : {}),

    billingAdapters: [
      {
        provider: "aws",
        ingestMode: LIVE_MODE ? ("live" as const) : ("deterministic" as const),

        async load(periodStart: string, periodEnd: string): Promise<BillingPeriodSummary> {
          if (LIVE_MODE) {
            // ── Phase 9: live AWS Cost Explorer call ──────────────────────────
            // Calls GetCostAndUsage with MONTHLY granularity, UnblendedCost metric,
            // grouped by SERVICE dimension. Maps response to BillingPeriodSummary.
            // Propagates SDK errors to the MCP transport (→ 500 TOOL_EXECUTION_FAILED).
            return callCostExplorer(periodStart, periodEnd);
          }

          // ── Deterministic mode ─────────────────────────────────────────────
          // Return fixture data regardless of requested period.
          return data;
        },
      },
    ],
  },
};
