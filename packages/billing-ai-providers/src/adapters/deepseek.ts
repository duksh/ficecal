// ─── DeepSeek billing adapter ────────────────────────────────────────────────
//
// Live mode:  DeepSeek does not yet expose a historical usage API.
//             Balance endpoint: GET https://api.deepseek.com/user/balance
//             Full usage history planned for their dashboard API (Phase 11).
// Deterministic mode: fixture covering DeepSeek-V3 and DeepSeek-R1

import type { AiProviderBillingAdapter, ProviderCredentials, ProviderUsageRecord } from "../interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

const FIXTURE_USAGE: ProviderUsageRecord[] = [
  {
    modelId:      "deepseek-chat",   // DeepSeek-V3
    inputTokens:  18_700_000,
    outputTokens: 4_200_000,
    requestCount: 28_400,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
  {
    modelId:      "deepseek-reasoner",  // DeepSeek-R1
    inputTokens:  7_300_000,
    outputTokens: 3_100_000,
    requestCount: 4_920,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
  },
];

export const deepSeekAdapter: AiProviderBillingAdapter = {
  providerId:  "deepseek",
  displayName: "DeepSeek API",
  ingestMode:  "deterministic",

  async fetchUsage(
    periodStart: string,
    periodEnd: string,
    _credentials: ProviderCredentials,
    _pricingCatalog?: ModelPricingReference[],
  ): Promise<ProviderUsageRecord[]> {
    // DeepSeek does not yet expose a historical per-model usage API.
    // Deterministic mode returns fixture; live mode is blocked with an informative error.
    if (this.ingestMode === "deterministic") {
      return FIXTURE_USAGE.map((r) => ({ ...r, periodStart, periodEnd }));
    }

    throw new Error(
      `DeepSeek live billing: no historical usage API is available yet. ` +
      `DeepSeek exposes only a balance endpoint (/user/balance). ` +
      `Full usage history integration is planned for Phase 11.`,
    );
  },
};
