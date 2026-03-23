// ─── OpenAI Billing Plugin ─────────────────────────────────────────────────────
//
// Phase 6 billing plugin for OpenAI.
// Ingest mode: deterministic (fixture data from packages/schemas/fixtures/).
// Live mode (OpenAI Usage API): deferred to Phase 7+.

import type { FicecalPlugin, BillingPeriodSummary } from "@ficecal/plugin-api";
import openaiFixture from "../../../../packages/schemas/fixtures/openai-billing-fixture.json" with { type: "json" };

const data = openaiFixture.data as BillingPeriodSummary;

export const openaiBillingPlugin: FicecalPlugin = {
  id: "@ficecal/billing-openai",
  name: "OpenAI Billing Adapter",
  version: "1.0.0",
  description:
    "Deterministic OpenAI billing adapter for Phase 6. " +
    "Returns usage export fixture data. Live API integration deferred to Phase 7+.",
  contributions: {
    billingFixtures: [
      {
        provider: "openai",
        version: openaiFixture.version,
        rawFormat: "openai-usage-export",
        data,
      },
    ],
    billingAdapters: [
      {
        provider: "openai",
        ingestMode: "deterministic",
        async load(_periodStart: string, _periodEnd: string): Promise<BillingPeriodSummary> {
          return data;
        },
      },
    ],
  },
};
