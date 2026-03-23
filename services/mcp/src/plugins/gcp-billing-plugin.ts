// ─── GCP Billing Plugin ────────────────────────────────────────────────────────
//
// Phase 6 billing plugin for Google Cloud Platform.
// Ingest mode: deterministic (fixture data from packages/schemas/fixtures/).
// Live mode (GCP BigQuery Billing Export): Gap I3 — stub when GCP_BILLING_PROJECT_ID is set.
//
// To activate live-mode stub:
//   GCP_BILLING_PROJECT_ID=my-project FICECAL_LIVE_BILLING=1 npm start
//
// Full implementation requires Cloud Billing Export to BigQuery:
//   https://cloud.google.com/billing/docs/how-to/export-data-bigquery

import type { FicecalPlugin, BillingPeriodSummary } from "@ficecal/plugin-api";
import gcpFixture from "../../../../packages/schemas/fixtures/gcp-billing-fixture.json" assert { type: "json" };

const data = gcpFixture.data as BillingPeriodSummary;

// ─── Live mode detection ───────────────────────────────────────────────────────

const GCP_LIVE_MODE =
  process.env["FICECAL_LIVE_BILLING"] === "1" &&
  typeof process.env["GCP_BILLING_PROJECT_ID"] === "string" &&
  process.env["GCP_BILLING_PROJECT_ID"].length > 0;

if (GCP_LIVE_MODE) {
  console.log(
    `[ficecal:gcp-live] BigQuery Billing Export — live mode STUB ` +
    `(project: ${process.env["GCP_BILLING_PROJECT_ID"]})`
  );
}

// ─── Live adapter (stub) ──────────────────────────────────────────────────────

const gcpLiveAdapter = {
  provider: "gcp",
  ingestMode: "live" as const,
  async load(_periodStart: string, _periodEnd: string): Promise<BillingPeriodSummary> {
    // STUB: Real implementation would query BigQuery:
    //   SELECT * FROM `project.dataset.gcp_billing_export_v1_XXXXXX`
    //   WHERE DATE(usage_start_time) BETWEEN @start AND @end
    console.log("[ficecal:gcp-live] load() called — returning fixture data (STUB)");
    return {
      ...data,
      _liveStubWarning:
        "GCP live billing integration requires Cloud Billing Export to BigQuery. " +
        "Configure via GCP_BILLING_EXPORT_DATASET env var.",
    } as BillingPeriodSummary;
  },
};

// ─── Plugin export ────────────────────────────────────────────────────────────

export const gcpBillingPlugin: FicecalPlugin = {
  id: "@ficecal/billing-gcp",
  name: "GCP Billing Adapter",
  version: "1.1.0",
  description:
    "GCP billing adapter. " +
    "Deterministic mode: returns BigQuery Billing Export fixture data. " +
    "Live mode (STUB): activated when GCP_BILLING_PROJECT_ID + FICECAL_LIVE_BILLING=1 are set.",
  contributions: {
    billingFixtures: [
      {
        provider: "gcp",
        version: gcpFixture.version,
        rawFormat: "gcp-billing-export",
        data,
      },
    ],
    billingAdapters: [
      {
        provider: "gcp",
        ingestMode: "deterministic",
        async load(_periodStart: string, _periodEnd: string): Promise<BillingPeriodSummary> {
          return data;
        },
      },
      ...(GCP_LIVE_MODE ? [gcpLiveAdapter] : []),
    ],
  },
};
