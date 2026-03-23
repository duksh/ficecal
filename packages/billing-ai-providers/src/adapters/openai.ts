// ─── OpenAI billing adapter ───────────────────────────────────────────────────
//
// Fetches token usage from the OpenAI API for a given period.
//
// Live mode:  GET https://api.openai.com/v1/organization/usage/completions
//             Requires: OPENAI_API_KEY
//             Params: start_time (unix seconds), end_time, bucket_width=1d
// Deterministic mode: realistic fixture covering GPT-4o, o1, GPT-4o-mini

import type { AiProviderBillingAdapter, ProviderCredentials, ProviderUsageRecord } from "../interface.js";
import { CredentialsRequiredError } from "../interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Fixture data ──────────────────────────────────────────────────────────────

const FIXTURE_USAGE: ProviderUsageRecord[] = [
  {
    modelId:      "gpt-4o",
    inputTokens:  22_400_000,
    outputTokens: 4_100_000,
    cachedInputTokens: 5_600_000,
    requestCount: 8_340,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "gpt-4o-mini",
    inputTokens:  89_000_000,
    outputTokens: 18_300_000,
    requestCount: 142_000,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "o1",
    inputTokens:  3_100_000,
    outputTokens: 940_000,
    requestCount: 520,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toUnixSeconds(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1000);
}

// ─── Adapter ───────────────────────────────────────────────────────────────────

export const openAiAdapter: AiProviderBillingAdapter = {
  providerId:  "openai",
  displayName: "OpenAI API",
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

    const apiKey = credentials.apiKey ?? process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new CredentialsRequiredError("openai", "apiKey / OPENAI_API_KEY");

    // OpenAI Usage API v2 (completions bucket)
    const url =
      `https://api.openai.com/v1/organization/usage/completions` +
      `?start_time=${toUnixSeconds(periodStart)}` +
      `&end_time=${toUnixSeconds(periodEnd)}` +
      `&bucket_width=1d` +
      `&limit=100`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      throw new Error(`OpenAI usage API error ${res.status}: ${await res.text()}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;

    // Aggregate across daily buckets per model
    const byModel = new Map<string, { input: number; output: number; cached: number; reqs: number }>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const bucket of (body.data ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const result of (bucket.results ?? [])) {
        const model = result.model ?? "unknown";
        const existing = byModel.get(model) ?? { input: 0, output: 0, cached: 0, reqs: 0 };
        byModel.set(model, {
          input:  existing.input  + (result.input_tokens  ?? 0),
          output: existing.output + (result.output_tokens ?? 0),
          cached: existing.cached + (result.input_cached_tokens ?? 0),
          reqs:   existing.reqs   + (result.num_model_requests  ?? 0),
        });
      }
    }

    return [...byModel.entries()].map(([modelId, totals]): ProviderUsageRecord => ({
      modelId,
      inputTokens:       totals.input,
      outputTokens:      totals.output,
      cachedInputTokens: totals.cached > 0 ? totals.cached : undefined,
      requestCount:      totals.reqs,
      currency:          "USD",
      periodStart,
      periodEnd,
    }));
  },
};
