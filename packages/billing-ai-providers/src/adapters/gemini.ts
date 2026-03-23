// ─── Google Gemini billing adapter ───────────────────────────────────────────
//
// Fetches token usage from Google AI Studio or Vertex AI for a given period.
//
// Live mode:  Google Cloud Monitoring API for Vertex AI usage metrics
//             Requires: GOOGLE_API_KEY or GCP service account + GCP_PROJECT
// Deterministic mode: realistic fixture covering Gemini model family

import type { AiProviderBillingAdapter, ProviderCredentials, ProviderUsageRecord } from "../interface.js";
import { CredentialsRequiredError } from "../interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

const FIXTURE_USAGE: ProviderUsageRecord[] = [
  {
    modelId:      "gemini-2.0-flash",
    inputTokens:  41_200_000,
    outputTokens: 9_800_000,
    requestCount: 62_400,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "gemini-1.5-pro",
    inputTokens:  8_700_000,
    outputTokens: 1_900_000,
    requestCount: 2_810,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "gemini-1.5-flash",
    inputTokens:  19_600_000,
    outputTokens: 4_300_000,
    requestCount: 28_700,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
];

export const geminiAdapter: AiProviderBillingAdapter = {
  providerId:  "google",
  displayName: "Google Gemini API",
  ingestMode:  "deterministic",

  async fetchUsage(
    periodStart: string,
    periodEnd: string,
    credentials: ProviderCredentials,
    _pricingCatalog?: ModelPricingReference[],
  ): Promise<ProviderUsageRecord[]> {
    if (this.ingestMode === "deterministic") {
      return FIXTURE_USAGE.map((r) => ({ ...r, periodStart, periodEnd }));
    }

    // Live path: Google Cloud Monitoring API for Vertex AI token usage
    // Requires GCP project + credentials (service account or GOOGLE_API_KEY)
    const gcpProject = credentials.gcpProject ?? process.env["GCP_PROJECT"];
    if (!gcpProject) throw new CredentialsRequiredError("google", "gcpProject / GCP_PROJECT");

    // Vertex AI usage metrics via Cloud Monitoring API:
    // POST https://monitoring.googleapis.com/v3/projects/{project}/timeSeries:query
    // Metric: aiplatform.googleapis.com/prediction/online/token_count (split by model)
    // For now: throw informative error — full Vertex AI monitoring integration is Phase 11
    throw new Error(
      `Google Gemini live billing requires Cloud Monitoring API integration. ` +
      `Project "${gcpProject}" detected. This adapter returns fixture data in deterministic mode. ` +
      `Full Vertex AI billing export integration is planned for Phase 11.`,
    );
  },
};
