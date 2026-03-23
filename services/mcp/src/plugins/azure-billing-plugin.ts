// ─── Azure Billing Plugin ──────────────────────────────────────────────────────
//
// Phase 6 billing plugin for Microsoft Azure.
// Ingest mode: deterministic (fixture data from packages/schemas/fixtures/).
// Live mode (Azure Cost Management REST API): Gap I4 — stub when AZURE_SUBSCRIPTION_ID is set.
//
// To activate live-mode stub:
//   AZURE_SUBSCRIPTION_ID=sub-xxxx FICECAL_LIVE_BILLING=1 npm start
//
// Full implementation requires Azure Cost Management REST API or exports:
//   https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-export-acm-data

import type { FicecalPlugin, BillingPeriodSummary } from "@ficecal/plugin-api";
import azureFixture from "../../../../packages/schemas/fixtures/azure-billing-fixture.json" assert { type: "json" };

const data = azureFixture.data as BillingPeriodSummary;

// ─── Live mode detection ───────────────────────────────────────────────────────

const AZURE_LIVE_MODE =
  process.env["FICECAL_LIVE_BILLING"] === "1" &&
  typeof process.env["AZURE_SUBSCRIPTION_ID"] === "string" &&
  process.env["AZURE_SUBSCRIPTION_ID"].length > 0;

if (AZURE_LIVE_MODE) {
  console.log(
    `[ficecal:azure-live] Cost Management Export — live mode STUB ` +
    `(subscription: ${process.env["AZURE_SUBSCRIPTION_ID"]})`
  );
}

// ─── Live adapter (stub) ──────────────────────────────────────────────────────

const azureLiveAdapter = {
  provider: "azure",
  ingestMode: "live" as const,
  async load(_periodStart: string, _periodEnd: string): Promise<BillingPeriodSummary> {
    // STUB: Real implementation would call:
    //   GET /subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query
    console.log("[ficecal:azure-live] load() called — returning fixture data (STUB)");
    return {
      ...data,
      _liveStubWarning:
        "Azure live billing integration requires Cost Management export. " +
        "Configure via AZURE_BILLING_ACCOUNT_ID env var.",
    } as BillingPeriodSummary;
  },
};

// ─── Plugin export ────────────────────────────────────────────────────────────

export const azureBillingPlugin: FicecalPlugin = {
  id: "@ficecal/billing-azure",
  name: "Azure Billing Adapter",
  version: "1.1.0",
  description:
    "Azure billing adapter. " +
    "Deterministic mode: returns Cost Management fixture data. " +
    "Live mode (STUB): activated when AZURE_SUBSCRIPTION_ID + FICECAL_LIVE_BILLING=1 are set.",
  contributions: {
    billingFixtures: [
      {
        provider: "azure",
        version: azureFixture.version,
        rawFormat: "azure-cost-management",
        data,
      },
    ],
    billingAdapters: [
      {
        provider: "azure",
        ingestMode: "deterministic",
        async load(_periodStart: string, _periodEnd: string): Promise<BillingPeriodSummary> {
          return data;
        },
      },
      ...(AZURE_LIVE_MODE ? [azureLiveAdapter] : []),
    ],
  },
};
