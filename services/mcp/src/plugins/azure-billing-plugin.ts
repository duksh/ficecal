// ─── Azure Billing Plugin ──────────────────────────────────────────────────────
//
// Phase 9: supports both deterministic (fixture) and live (Azure Cost Management
// REST API) ingest modes, following the same pattern as the AWS billing plugin.
//
// Mode selection:
//   FICECAL_LIVE_BILLING=1 + AZURE_SUBSCRIPTION_ID set  →  ingestMode: "live"
//     Calls Azure Cost Management Query API via native fetch.
//     Requires a service principal (AZURE_TENANT_ID, AZURE_CLIENT_ID,
//     AZURE_CLIENT_SECRET) or ambient Azure credentials.
//   (default)  →  ingestMode: "deterministic" (fixture data)
//
// Auth (live mode):
//   Uses @azure/identity ClientSecretCredential for service principal auth.
//   Required RBAC role: Cost Management Reader on the subscription.
//
// Required env vars (live mode):
//   AZURE_SUBSCRIPTION_ID  — Azure subscription ID
//   AZURE_TENANT_ID        — Azure AD tenant ID
//   AZURE_CLIENT_ID        — service principal app (client) ID
//   AZURE_CLIENT_SECRET    — service principal client secret
//   FICECAL_LIVE_BILLING=1 — enable live mode

import type { FicecalPlugin, BillingPeriodSummary } from "@ficecal/plugin-api";
import type { BillingLineItem } from "@ficecal/plugin-api";
import azureFixture from "../../../../packages/schemas/fixtures/azure-billing-fixture.json" with { type: "json" };

const data = azureFixture.data as BillingPeriodSummary;

// ─── Live mode detection ──────────────────────────────────────────────────────

const AZURE_LIVE_MODE =
  process.env["FICECAL_LIVE_BILLING"] === "1" &&
  typeof process.env["AZURE_SUBSCRIPTION_ID"] === "string" &&
  process.env["AZURE_SUBSCRIPTION_ID"].length > 0;

// ─── Azure Cost Management API response types ─────────────────────────────────

// The Cost Management Query API returns a columnar result set:
// { properties: { columns: [{name, type}], rows: [any[]] } }
interface CostMgmtColumn {
  name: string;
  type: string;
}

interface CostMgmtQueryResult {
  properties: {
    columns: CostMgmtColumn[];
    rows: (string | number | null)[][];
  };
}

// ─── Cost Management response → BillingPeriodSummary mapper ──────────────────

function mapCostMgmtResponse(
  result: CostMgmtQueryResult,
  periodStart: string,
  periodEnd: string,
): { lineItems: BillingLineItem[]; totalCost: number; currency: string } {
  const columns = result.properties.columns;
  const rows = result.properties.rows;

  // Build a column-name → index map for resilient parsing
  const colIndex = Object.fromEntries(
    columns.map((c, i) => [c.name.toLowerCase(), i]),
  );

  const costIdx = colIndex["cost"] ?? colIndex["totalcost"] ?? 0;
  const serviceIdx = colIndex["servicename"] ?? colIndex["service"] ?? 1;
  const currencyIdx = colIndex["currency"] ?? -1;

  const lineItems: BillingLineItem[] = [];
  let totalCost = 0;
  let currency = "USD";

  for (const row of rows) {
    const cost = typeof row[costIdx] === "number" ? (row[costIdx] as number) : 0;
    const service =
      typeof row[serviceIdx] === "string" ? (row[serviceIdx] as string) : "Unknown";
    if (currencyIdx >= 0 && typeof row[currencyIdx] === "string") {
      currency = row[currencyIdx] as string;
    }

    totalCost += cost;

    lineItems.push({
      service,
      sku: `${service}-CostManagement`,
      usageType: service,
      cost: parseFloat(cost.toFixed(10)),
      currency,
      startDate: periodStart,
      endDate: periodEnd,
    });
  }

  return { lineItems, totalCost: parseFloat(totalCost.toFixed(10)), currency };
}

// ─── Live adapter ─────────────────────────────────────────────────────────────

async function callAzureCostManagement(
  periodStart: string,
  periodEnd: string,
): Promise<BillingPeriodSummary> {
  // Dynamic import: only pulls in the SDK in live mode.
  const { ClientSecretCredential } = await import("@azure/identity");

  const subscriptionId = process.env["AZURE_SUBSCRIPTION_ID"] as string;
  const tenantId = process.env["AZURE_TENANT_ID"] as string | undefined;
  const clientId = process.env["AZURE_CLIENT_ID"] as string | undefined;
  const clientSecret = process.env["AZURE_CLIENT_SECRET"] as string | undefined;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "[ficecal:azure-live] AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET " +
        "must be set for live mode. Alternatively, disable live mode by unsetting " +
        "FICECAL_LIVE_BILLING.",
    );
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  // Acquire a token for the Azure Resource Manager scope
  const tokenResponse = await credential.getToken(
    "https://management.azure.com/.default",
  );
  const accessToken = tokenResponse.token;

  const apiVersion = "2023-11-01";
  const url =
    `https://management.azure.com/subscriptions/${subscriptionId}` +
    `/providers/Microsoft.CostManagement/query?api-version=${apiVersion}`;

  const body = {
    type: "Usage",
    timeframe: "Custom",
    timePeriod: { from: periodStart, to: periodEnd },
    dataset: {
      granularity: "Monthly",
      aggregation: {
        totalCost: { name: "Cost", function: "Sum" },
      },
      grouping: [{ type: "Dimension", name: "ServiceName" }],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[ficecal:azure-live] Cost Management API returned ${response.status}: ${errorText}`,
    );
  }

  const json = (await response.json()) as CostMgmtQueryResult;
  const { lineItems, totalCost, currency } = mapCostMgmtResponse(
    json,
    periodStart,
    periodEnd,
  );

  return {
    provider: "azure",
    accountId: subscriptionId,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    totalCost,
    currency,
    lineItems,
    metadata: {
      source: "azure-cost-management",
      subscriptionId,
      apiVersion,
      granularity: "Monthly",
    },
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const azureBillingPlugin: FicecalPlugin = {
  id: "@ficecal/billing-azure",
  name: "Azure Billing Adapter",
  version: "2.0.0", // bumped for Phase 9 live Cost Management integration
  description: AZURE_LIVE_MODE
    ? "Azure billing adapter — live mode. " +
      "Calls Azure Cost Management Query API (ServiceName grouping, monthly). " +
      "Requires service principal credentials with Cost Management Reader role."
    : "Azure billing adapter — deterministic mode. " +
      "Returns Cost Management fixture data. " +
      "Set FICECAL_LIVE_BILLING=1 + AZURE_SUBSCRIPTION_ID for live mode.",
  contributions: {
    // Fixtures only in deterministic mode
    ...(!AZURE_LIVE_MODE
      ? {
          billingFixtures: [
            {
              provider: "azure",
              version: azureFixture.version,
              rawFormat: "azure-cost-management" as const,
              data,
            },
          ],
        }
      : {}),

    billingAdapters: [
      {
        provider: "azure",
        ingestMode: AZURE_LIVE_MODE ? ("live" as const) : ("deterministic" as const),

        async load(periodStart: string, periodEnd: string): Promise<BillingPeriodSummary> {
          if (AZURE_LIVE_MODE) {
            // ── Phase 9: live Azure Cost Management query ─────────────────────
            // POSTs to the Cost Management Query API grouped by ServiceName,
            // monthly granularity. Maps columnar response to BillingPeriodSummary.
            // Propagates fetch/auth errors to the MCP transport (→ 500).
            return callAzureCostManagement(periodStart, periodEnd);
          }

          // ── Deterministic mode ─────────────────────────────────────────────
          return data;
        },
      },
    ],
  },
};
