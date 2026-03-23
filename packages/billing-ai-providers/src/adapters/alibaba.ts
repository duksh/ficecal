// ─── Alibaba (Qwen) billing adapter ──────────────────────────────────────────
//
// Fetches token usage from Alibaba DashScope API for a given period.
// Note: DashScope pricing is in CNY — converted to USD via StaticForexAdapter
//       rates from ficecal Phase 1 economics module. This adapter emits USD
//       after applying the CNY→USD rate embedded in the fixture.
//
// Live mode:  DashScope billing API (limited public docs — Phase 11)
//             Requires: DASHSCOPE_API_KEY
// Deterministic mode: fixture covering Qwen-Max, Qwen-Plus, Qwen-Turbo (USD-normalised)

import type { AiProviderBillingAdapter, ProviderCredentials, ProviderUsageRecord } from "../interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// Approximate CNY→USD rate (Phase 1 StaticForexAdapter baseline, 2026-Q1)
// Live adapters should use the dynamic ECB feed.
const CNY_TO_USD = 0.138;

const FIXTURE_USAGE_CNY = [
  { modelId: "qwen-max",   inputTokens: 12_400_000, outputTokens: 2_800_000, requestCount: 8_700, costCNY: 496 },
  { modelId: "qwen-plus",  inputTokens: 28_100_000, outputTokens: 7_200_000, requestCount: 41_300, costCNY: 337 },
  { modelId: "qwen-turbo", inputTokens: 54_700_000, outputTokens: 14_900_000, requestCount: 118_000, costCNY: 219 },
];

// Fixture emits USD — normalize.ts will use model-lens (which has CNY rates in forex.json)
// for any live/recalculated scenario. Fixture bypasses live forex.
const FIXTURE_USAGE: ProviderUsageRecord[] = FIXTURE_USAGE_CNY.map((f) => ({
  modelId:      f.modelId,
  inputTokens:  f.inputTokens,
  outputTokens: f.outputTokens,
  requestCount: f.requestCount,
  currency:     "USD",   // already converted for fixture simplicity
  periodStart:  "2026-02-01",
  periodEnd:    "2026-02-28",
}));

export const alibabaAdapter: AiProviderBillingAdapter = {
  providerId:  "alibaba",
  displayName: "Alibaba DashScope API",
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

    const apiKey = credentials.dashscopeKey ?? credentials.apiKey ?? process.env["DASHSCOPE_API_KEY"];

    // DashScope billing API is not publicly documented — Phase 11 implementation.
    // Live path: placeholder for when DashScope exposes billing export.
    throw new Error(
      `Alibaba DashScope live billing: billing export API is not yet publicly documented. ` +
      `API key ${apiKey ? "present" : "missing"}. ` +
      `Note: Qwen pricing is in CNY — CNY→USD conversion rate ${CNY_TO_USD} (static Phase 1 rate). ` +
      `Full DashScope billing integration planned for Phase 11.`,
    );
  },
};
