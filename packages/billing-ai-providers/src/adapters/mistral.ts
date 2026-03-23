// ─── Mistral AI billing adapter ───────────────────────────────────────────────
//
// Live mode:  GET https://api.mistral.ai/v1/usage (monthly usage)
//             Requires: MISTRAL_API_KEY
// Deterministic mode: fixture covering Mistral Large, Codestral, Mistral Small

import type { AiProviderBillingAdapter, ProviderCredentials, ProviderUsageRecord } from "../interface.js";
import { CredentialsRequiredError } from "../interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

const FIXTURE_USAGE: ProviderUsageRecord[] = [
  {
    modelId:      "mistral-large-latest",
    inputTokens:  6_400_000,
    outputTokens: 1_200_000,
    requestCount: 3_820,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "codestral-latest",
    inputTokens:  12_100_000,
    outputTokens: 4_800_000,
    requestCount: 7_640,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "mistral-small-latest",
    inputTokens:  24_300_000,
    outputTokens: 6_100_000,
    requestCount: 41_200,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
];

export const mistralAdapter: AiProviderBillingAdapter = {
  providerId:  "mistral",
  displayName: "Mistral AI API",
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

    const apiKey = credentials.apiKey ?? process.env["MISTRAL_API_KEY"];
    if (!apiKey) throw new CredentialsRequiredError("mistral", "apiKey / MISTRAL_API_KEY");

    // Mistral Usage API: GET /v1/usage?month=YYYY-MM
    // Currently month-level granularity only
    const month = periodStart.slice(0, 7); // "YYYY-MM"
    const res = await fetch(`https://api.mistral.ai/v1/usage?month=${month}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`Mistral usage API error ${res.status}: ${await res.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;

    // Response shape: { data: [{ model, usage: { prompt_tokens, completion_tokens } }] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (body.data ?? []).map((entry: any): ProviderUsageRecord => ({
      modelId:      entry.model ?? "unknown",
      inputTokens:  entry.usage?.prompt_tokens     ?? 0,
      outputTokens: entry.usage?.completion_tokens ?? 0,
      currency:     "USD",
      periodStart,
      periodEnd,
    }));
  },
};
