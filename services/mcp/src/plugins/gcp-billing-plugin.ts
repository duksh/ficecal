// ─── GCP Billing Plugin ────────────────────────────────────────────────────────
//
// Phase 9: supports both deterministic (fixture) and live (BigQuery Billing Export)
// ingest modes, following the same pattern as the AWS billing plugin.
//
// Mode selection:
//   FICECAL_LIVE_BILLING=1 + GCP_BILLING_PROJECT_ID set  →  ingestMode: "live"
//     Calls GCP BigQuery Billing Export table.
//     Requires ambient GCP credentials (GOOGLE_APPLICATION_CREDENTIALS or ADC).
//   (default)  →  ingestMode: "deterministic" (fixture data)
//
// Credentials (live mode):
//   Application Default Credentials (ADC) chain — set GOOGLE_APPLICATION_CREDENTIALS
//   to a service account JSON path, or use gcloud auth application-default login,
//   or rely on Workload Identity on GCP-hosted environments.
//   Required BigQuery permissions: bigquery.jobs.create + bigquery.tables.getData.
//
// Required env vars (live mode):
//   GCP_BILLING_PROJECT_ID  — GCP project containing the billing dataset
//   GCP_BILLING_DATASET     — BigQuery dataset name (default: billing_export)
//   GCP_BILLING_TABLE       — table name (default: gcp_billing_export_v1)
//   GOOGLE_APPLICATION_CREDENTIALS — path to service account JSON (optional, uses ADC)

import type { FicecalPlugin, BillingPeriodSummary } from "@ficecal/plugin-api";
import type { BillingLineItem } from "@ficecal/plugin-api";
import gcpFixture from "../../../../packages/schemas/fixtures/gcp-billing-fixture.json" assert { type: "json" };

const data = gcpFixture.data as BillingPeriodSummary;

// ─── Live mode detection ──────────────────────────────────────────────────────

const GCP_LIVE_MODE =
  process.env["FICECAL_LIVE_BILLING"] === "1" &&
  typeof process.env["GCP_BILLING_PROJECT_ID"] === "string" &&
  process.env["GCP_BILLING_PROJECT_ID"].length > 0;

// ─── BigQuery result row type ─────────────────────────────────────────────────

interface BigQueryBillingRow {
  service: string | null;
  totalCost: number | null;
  currency: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
}

// ─── BigQuery → BillingPeriodSummary mapper ───────────────────────────────────

function mapRowsToLineItems(
  rows: BigQueryBillingRow[],
  periodStart: string,
  periodEnd: string,
): { lineItems: BillingLineItem[]; totalCost: number; currency: string } {
  const lineItems: BillingLineItem[] = [];
  let totalCost = 0;
  let currency = "USD";

  for (const row of rows) {
    const service = row.service ?? "Unknown";
    const cost = typeof row.totalCost === "number" ? row.totalCost : 0;
    const rowCurrency = row.currency ?? "USD";

    // Use the row currency (last non-null wins for summary currency)
    currency = rowCurrency;
    totalCost += cost;

    const startDate =
      row.startTime instanceof Date
        ? row.startTime.toISOString().slice(0, 10)
        : typeof row.startTime === "string"
          ? row.startTime.slice(0, 10)
          : periodStart;

    const endDate =
      row.endTime instanceof Date
        ? row.endTime.toISOString().slice(0, 10)
        : typeof row.endTime === "string"
          ? row.endTime.slice(0, 10)
          : periodEnd;

    lineItems.push({
      service,
      sku: `${service}-BigQueryBillingExport`,
      usageType: service,
      cost: parseFloat(cost.toFixed(10)),
      currency: rowCurrency,
      startDate,
      endDate,
    });
  }

  return { lineItems, totalCost: parseFloat(totalCost.toFixed(10)), currency };
}

// ─── Live adapter ─────────────────────────────────────────────────────────────

async function callBigQueryBilling(
  periodStart: string,
  periodEnd: string,
): Promise<BillingPeriodSummary> {
  // Dynamic import: only pulls in the SDK in live mode.
  const { BigQuery } = await import("@google-cloud/bigquery");

  const projectId = process.env["GCP_BILLING_PROJECT_ID"] as string;
  const dataset =
    (process.env["GCP_BILLING_DATASET"] as string | undefined) ??
    "billing_export";
  const table =
    (process.env["GCP_BILLING_TABLE"] as string | undefined) ??
    "gcp_billing_export_v1";

  // BigQuery constructor picks up GOOGLE_APPLICATION_CREDENTIALS automatically
  // if set, otherwise falls back to the full ADC chain.
  const bigquery = new BigQuery({ projectId });

  const query = `
    SELECT
      service.description AS service,
      SUM(cost) AS totalCost,
      currency,
      MIN(usage_start_time) AS startTime,
      MAX(usage_start_time) AS endTime
    FROM \`${projectId}.${dataset}.${table}\`
    WHERE DATE(usage_start_time) BETWEEN @start AND @end
    GROUP BY service.description, currency
    ORDER BY totalCost DESC
  `;

  const options = {
    query,
    params: { start: periodStart, end: periodEnd },
    // Run the query in the billing project itself
    location: "US",
  };

  const [rows] = await bigquery.query(options);
  const typedRows = rows as BigQueryBillingRow[];

  const { lineItems, totalCost, currency } = mapRowsToLineItems(
    typedRows,
    periodStart,
    periodEnd,
  );

  return {
    provider: "gcp",
    accountId: projectId,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    totalCost,
    currency,
    lineItems,
    metadata: {
      source: "gcp-bigquery-billing-export",
      project: projectId,
      dataset,
      table,
    },
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const gcpBillingPlugin: FicecalPlugin = {
  id: "@ficecal/billing-gcp",
  name: "GCP Billing Adapter",
  version: "2.0.0", // bumped for Phase 9 live BigQuery integration
  description: GCP_LIVE_MODE
    ? "GCP billing adapter — live mode. " +
      "Queries BigQuery Billing Export table (standard schema). " +
      "Requires ambient GCP credentials with bigquery.jobs.create + bigquery.tables.getData."
    : "GCP billing adapter — deterministic mode. " +
      "Returns BigQuery Billing Export fixture data. " +
      "Set FICECAL_LIVE_BILLING=1 + GCP_BILLING_PROJECT_ID for live mode.",
  contributions: {
    // Fixtures only in deterministic mode
    ...(!GCP_LIVE_MODE
      ? {
          billingFixtures: [
            {
              provider: "gcp",
              version: gcpFixture.version,
              rawFormat: "gcp-billing-export" as const,
              data,
            },
          ],
        }
      : {}),

    billingAdapters: [
      {
        provider: "gcp",
        ingestMode: GCP_LIVE_MODE ? ("live" as const) : ("deterministic" as const),

        async load(periodStart: string, periodEnd: string): Promise<BillingPeriodSummary> {
          if (GCP_LIVE_MODE) {
            // ── Phase 9: live GCP BigQuery Billing Export call ────────────────
            // Queries the standard billing export table, grouped by service,
            // for the requested date range. Maps to BillingPeriodSummary.
            // Propagates SDK errors to the MCP transport (→ 500 TOOL_EXECUTION_FAILED).
            return callBigQueryBilling(periodStart, periodEnd);
          }

          // ── Deterministic mode ─────────────────────────────────────────────
          return data;
        },
      },
    ],
  },
};
