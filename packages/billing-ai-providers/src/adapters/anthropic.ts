// ─── Anthropic billing adapter ────────────────────────────────────────────────
//
// Fetches token usage from the Anthropic API for a given period.
//
// Live mode:  GET https://api.anthropic.com/v1/organizations/{orgId}/usage
//             Requires: ANTHROPIC_API_KEY + ANTHROPIC_ORG_ID (or credentials)
// Deterministic mode: returns realistic fixture data covering Claude model family

import type { AiProviderBillingAdapter, ProviderCredentials, ProviderUsageRecord } from "../interface.js";
import { CredentialsRequiredError } from "../interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Fixture data ──────────────────────────────────────────────────────────────

const FIXTURE_USAGE: ProviderUsageRecord[] = [
  {
    modelId:      "claude-3-5-sonnet-20241022",
    inputTokens:  14_800_000,
    outputTokens: 2_100_000,
    cachedInputTokens: 3_200_000,
    requestCount: 4_210,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "claude-3-5-haiku-20241022",
    inputTokens:  31_500_000,
    outputTokens: 8_900_000,
    cachedInputTokens: 0,
    requestCount: 18_720,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "claude-3-opus-20240229",
    inputTokens:  1_200_000,
    outputTokens: 380_000,
    requestCount: 290,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
];

// ─── Adapter ───────────────────────────────────────────────────────────────────

export const anthropicAdapter: AiProviderBillingAdapter = {
  providerId:  "anthropic",
  displayName: "Anthropic API",
  ingestMode:  "deterministic",

  async fetchUsage(
    periodStart: string,
    periodEnd: string,
    credentials: ProviderCredentials,
    _pricingCatalog?: ModelPricingReference[],
  ): Promise<ProviderUsageRecord[]> {
    // ── Deterministic path (CI safe, no credentials needed) ────────────────
    if (this.ingestMode === "deterministic") {
      return FIXTURE_USAGE.map((r) => ({
        ...r,
        periodStart,
        periodEnd,
      }));
    }

    // ── Live path ───────────────────────────────────────────────────────────
    const apiKey = credentials.apiKey ?? process.env["ANTHROPIC_API_KEY"];
    const orgId  = credentials.organizationId ?? process.env["ANTHROPIC_ORG_ID"];

    if (!apiKey)  throw new CredentialsRequiredError("anthropic", "apiKey / ANTHROPIC_API_KEY");
    if (!orgId)   throw new CredentialsRequiredError("anthropic", "organizationId / ANTHROPIC_ORG_ID");

    // Anthropic usage API: GET /v1/organizations/{org_id}/usage
    // Query params: start_date, end_date (YYYY-MM-DD)
    const url = `https://api.anthropic.com/v1/organizations/${orgId}/usage` +
      `?start_date=${periodStart}&end_date=${periodEnd}`;

    const res = await fetch(url, {
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Anthropic usage API error ${res.status}: ${await res.text()}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await res.json() as any;

    // Response shape: { data: [{ model, usage: { input_tokens, output_tokens, cache_read_input_tokens } }] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (body.data ?? []).map((entry: any): ProviderUsageRecord => ({
      modelId:           entry.model ?? "unknown",
      inputTokens:       entry.usage?.input_tokens  ?? 0,
      outputTokens:      entry.usage?.output_tokens ?? 0,
      cachedInputTokens: entry.usage?.cache_read_input_tokens ?? undefined,
      currency:          "USD",
      periodStart,
      periodEnd,
      organizationId:    orgId,
    }));
  },
};
