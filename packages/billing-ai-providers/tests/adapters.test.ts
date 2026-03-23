// ─── adapters.test.ts ─────────────────────────────────────────────────────────
//
// Integration tests for all 6 built-in provider adapters and the package
// barrel exports. All adapters run in "deterministic" mode (fixtures only —
// no real API calls, safe in CI without credentials).
//
// Tests verify:
//   1. Deterministic fixture returns correct number of records
//   2. Period dates are overridden by the provided periodStart/periodEnd
//   3. Required ProviderUsageRecord fields are populated
//   4. Currency defaults to USD
//   5. AI_PROVIDER_ADAPTERS registry contains all 6 adapters
//   6. Re-export shape of the barrel index

import { describe, it, expect } from "vitest";

// ── Provider adapters ────────────────────────────────────────────────────────
import { anthropicAdapter } from "../src/adapters/anthropic.js";
import { openAiAdapter }    from "../src/adapters/openai.js";
import { geminiAdapter }    from "../src/adapters/gemini.js";
import { mistralAdapter }   from "../src/adapters/mistral.js";
import { deepSeekAdapter }  from "../src/adapters/deepseek.js";
import { alibabaAdapter }   from "../src/adapters/alibaba.js";

// ── Package barrel ───────────────────────────────────────────────────────────
import {
  AI_PROVIDER_ADAPTERS,
  CredentialsRequiredError,
  normalizeUsageRecords,
  lookupModelPricing,
} from "../src/index.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const PERIOD_START = "2026-01-01";
const PERIOD_END   = "2026-01-31";
const CREDS        = {};  // deterministic adapters ignore credentials

// ─── Shared adapter contract assertions ──────────────────────────────────────

async function assertAdapterContract(
  adapter: typeof anthropicAdapter,
  expectedModelCount: number,
  expectedModels: string[],
) {
  expect(adapter.ingestMode).toBe("deterministic");
  expect(typeof adapter.providerId).toBe("string");
  expect(adapter.providerId.length).toBeGreaterThan(0);
  expect(typeof adapter.displayName).toBe("string");
  expect(adapter.displayName.length).toBeGreaterThan(0);

  const records = await adapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);

  expect(records).toHaveLength(expectedModelCount);

  // Period override
  for (const r of records) {
    expect(r.periodStart).toBe(PERIOD_START);
    expect(r.periodEnd).toBe(PERIOD_END);
  }

  // Required fields
  for (const r of records) {
    expect(typeof r.modelId).toBe("string");
    expect(r.modelId.length).toBeGreaterThan(0);
    expect(typeof r.inputTokens).toBe("number");
    expect(r.inputTokens).toBeGreaterThanOrEqual(0);
    expect(typeof r.outputTokens).toBe("number");
    expect(r.outputTokens).toBeGreaterThanOrEqual(0);
    expect(r.currency).toBe("USD");
  }

  // Expected model IDs present
  const modelIds = records.map((r) => r.modelId);
  for (const expected of expectedModels) {
    expect(modelIds).toContain(expected);
  }
}

// ─── Anthropic adapter ────────────────────────────────────────────────────────

describe("anthropicAdapter", () => {
  it("has correct providerId and displayName", () => {
    expect(anthropicAdapter.providerId).toBe("anthropic");
    expect(anthropicAdapter.displayName).toBe("Anthropic API");
  });

  it("returns 3 fixture records covering Claude model family", async () => {
    await assertAdapterContract(anthropicAdapter, 3, [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ]);
  });

  it("claude-3-5-sonnet fixture has cachedInputTokens", async () => {
    const records = await anthropicAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const sonnet = records.find((r) => r.modelId === "claude-3-5-sonnet-20241022");
    expect(sonnet).toBeDefined();
    expect(sonnet!.cachedInputTokens).toBeGreaterThan(0);
  });

  it("fixture has requestCount populated", async () => {
    const records = await anthropicAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    for (const r of records) {
      expect(r.requestCount).toBeGreaterThan(0);
    }
  });

  it("overrides period dates to caller-supplied values", async () => {
    const records = await anthropicAdapter.fetchUsage("2025-11-01", "2025-11-30", CREDS);
    for (const r of records) {
      expect(r.periodStart).toBe("2025-11-01");
      expect(r.periodEnd).toBe("2025-11-30");
    }
  });

  it("fixture input tokens are in realistic range (>1M)", async () => {
    const records = await anthropicAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const totalInput = records.reduce((sum, r) => sum + r.inputTokens, 0);
    expect(totalInput).toBeGreaterThan(10_000_000);
  });
});

// ─── OpenAI adapter ───────────────────────────────────────────────────────────

describe("openAiAdapter", () => {
  it("has correct providerId", () => {
    expect(openAiAdapter.providerId).toBe("openai");
  });

  it("returns 3 fixture records covering GPT-4o, GPT-4o-mini, o1", async () => {
    await assertAdapterContract(openAiAdapter, 3, [
      "gpt-4o",
      "gpt-4o-mini",
      "o1",
    ]);
  });

  it("gpt-4o fixture has cachedInputTokens", async () => {
    const records = await openAiAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const gpt4o = records.find((r) => r.modelId === "gpt-4o");
    expect(gpt4o!.cachedInputTokens).toBeGreaterThan(0);
  });

  it("gpt-4o-mini is the highest volume model", async () => {
    const records = await openAiAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const mini = records.find((r) => r.modelId === "gpt-4o-mini")!;
    const gpt4o = records.find((r) => r.modelId === "gpt-4o")!;
    expect(mini.requestCount!).toBeGreaterThan(gpt4o.requestCount!);
  });
});

// ─── Gemini adapter ───────────────────────────────────────────────────────────

describe("geminiAdapter", () => {
  it("has correct providerId", () => {
    expect(geminiAdapter.providerId).toBe("google");
  });

  it("returns 3 fixture records covering Gemini model family", async () => {
    await assertAdapterContract(geminiAdapter, 3, [
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ]);
  });

  it("gemini-2.0-flash is highest volume model", async () => {
    const records = await geminiAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const flash = records.find((r) => r.modelId === "gemini-2.0-flash")!;
    const pro   = records.find((r) => r.modelId === "gemini-1.5-pro")!;
    expect(flash.inputTokens).toBeGreaterThan(pro.inputTokens);
  });
});

// ─── Mistral adapter ──────────────────────────────────────────────────────────

describe("mistralAdapter", () => {
  it("has correct providerId", () => {
    expect(mistralAdapter.providerId).toBe("mistral");
  });

  it("returns 3 fixture records covering Mistral model family", async () => {
    await assertAdapterContract(mistralAdapter, 3, [
      "mistral-large-latest",
      "codestral-latest",
      "mistral-small-latest",
    ]);
  });

  it("mistral-small has highest request volume", async () => {
    const records = await mistralAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const small = records.find((r) => r.modelId === "mistral-small-latest")!;
    const large = records.find((r) => r.modelId === "mistral-large-latest")!;
    expect(small.requestCount!).toBeGreaterThan(large.requestCount!);
  });
});

// ─── DeepSeek adapter ─────────────────────────────────────────────────────────

describe("deepSeekAdapter", () => {
  it("has correct providerId", () => {
    expect(deepSeekAdapter.providerId).toBe("deepseek");
  });

  it("returns 2 fixture records for DeepSeek-V3 and DeepSeek-R1", async () => {
    await assertAdapterContract(deepSeekAdapter, 2, [
      "deepseek-chat",
      "deepseek-reasoner",
    ]);
  });

  it("deepseek-chat (V3) has higher request count than reasoner (R1)", async () => {
    const records = await deepSeekAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const chat   = records.find((r) => r.modelId === "deepseek-chat")!;
    const reason = records.find((r) => r.modelId === "deepseek-reasoner")!;
    expect(chat.requestCount!).toBeGreaterThan(reason.requestCount!);
  });
});

// ─── Alibaba adapter ──────────────────────────────────────────────────────────

describe("alibabaAdapter", () => {
  it("has correct providerId", () => {
    expect(alibabaAdapter.providerId).toBe("alibaba");
  });

  it("returns 3 fixture records for Qwen model family", async () => {
    await assertAdapterContract(alibabaAdapter, 3, [
      "qwen-max",
      "qwen-plus",
      "qwen-turbo",
    ]);
  });

  it("all fixture records are in USD (converted from CNY)", async () => {
    const records = await alibabaAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    for (const r of records) {
      expect(r.currency).toBe("USD");
    }
  });

  it("qwen-turbo has highest request count (cheapest model)", async () => {
    const records = await alibabaAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const turbo = records.find((r) => r.modelId === "qwen-turbo")!;
    const max   = records.find((r) => r.modelId === "qwen-max")!;
    expect(turbo.requestCount!).toBeGreaterThan(max.requestCount!);
  });
});

// ─── AI_PROVIDER_ADAPTERS registry ───────────────────────────────────────────

describe("AI_PROVIDER_ADAPTERS", () => {
  it("is a ReadonlyMap", () => {
    expect(AI_PROVIDER_ADAPTERS).toBeInstanceOf(Map);
  });

  it("contains exactly 6 built-in adapters", () => {
    expect(AI_PROVIDER_ADAPTERS.size).toBe(6);
  });

  it("has 'anthropic' key", () => {
    expect(AI_PROVIDER_ADAPTERS.has("anthropic")).toBe(true);
  });

  it("has 'openai' key", () => {
    expect(AI_PROVIDER_ADAPTERS.has("openai")).toBe(true);
  });

  it("has 'google' key", () => {
    expect(AI_PROVIDER_ADAPTERS.has("google")).toBe(true);
  });

  it("has 'mistral' key", () => {
    expect(AI_PROVIDER_ADAPTERS.has("mistral")).toBe(true);
  });

  it("has 'deepseek' key", () => {
    expect(AI_PROVIDER_ADAPTERS.has("deepseek")).toBe(true);
  });

  it("has 'alibaba' key", () => {
    expect(AI_PROVIDER_ADAPTERS.has("alibaba")).toBe(true);
  });

  it("each adapter's providerId matches its registry key", () => {
    for (const [key, adapter] of AI_PROVIDER_ADAPTERS) {
      expect(adapter.providerId).toBe(key);
    }
  });

  it("all adapters are in deterministic mode", () => {
    for (const [, adapter] of AI_PROVIDER_ADAPTERS) {
      expect(adapter.ingestMode).toBe("deterministic");
    }
  });

  it("all adapters have non-empty displayName", () => {
    for (const [, adapter] of AI_PROVIDER_ADAPTERS) {
      expect(adapter.displayName.length).toBeGreaterThan(0);
    }
  });

  it("all adapters return at least 2 fixture records", async () => {
    for (const [, adapter] of AI_PROVIDER_ADAPTERS) {
      const records = await adapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
      expect(records.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── Barrel index re-exports ──────────────────────────────────────────────────

describe("barrel index re-exports", () => {
  it("exports CredentialsRequiredError class", () => {
    expect(typeof CredentialsRequiredError).toBe("function");
    const err = new CredentialsRequiredError("test-provider", "apiKey");
    expect(err.code).toBe("CREDENTIALS_REQUIRED");
    expect(err.providerId).toBe("test-provider");
    expect(err.message).toContain("test-provider");
    expect(err.message).toContain("apiKey");
    expect(err).toBeInstanceOf(Error);
  });

  it("exports normalizeUsageRecords as a function", () => {
    expect(typeof normalizeUsageRecords).toBe("function");
  });

  it("exports lookupModelPricing as a function", () => {
    expect(typeof lookupModelPricing).toBe("function");
  });

  it("CredentialsRequiredError is an Error subclass", () => {
    const err = new CredentialsRequiredError("provider", "key");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("Error");
  });
});

// ─── End-to-end: adapter → normalizer ────────────────────────────────────────
//
// Smoke test wiring all 3 layers together with a minimal pricing catalog.

describe("end-to-end: adapter → normalizer", () => {
  it("anthropicAdapter fixture → normalizeUsageRecords → 3 NormalizedCostRecords", async () => {
    const usage = await anthropicAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);

    // Minimal pricing catalog matching fixture model IDs
    const catalog = [
      { modelId: "claude-3-5-sonnet-20241022", cleanName: "Claude 3.5 Sonnet", company: "Anthropic", companyCountryCode: "US", vendorRef: "anthropic", regionCode: "global", sourceCatalog: "duksh-models" as const, sourceVersion: "test", effectiveAt: "2026-03-01", pricingUnit: "1M_tokens" as const, pricingSourceType: "verified" as const, inputTokenCost: 3.0, outputTokenCost: 15.0, cachedInputTokenCost: 0.3, reasoning: false, selfhostable: false },
      { modelId: "claude-3-5-haiku-20241022",  cleanName: "Claude 3.5 Haiku",  company: "Anthropic", companyCountryCode: "US", vendorRef: "anthropic", regionCode: "global", sourceCatalog: "duksh-models" as const, sourceVersion: "test", effectiveAt: "2026-03-01", pricingUnit: "1M_tokens" as const, pricingSourceType: "verified" as const, inputTokenCost: 0.8,  outputTokenCost: 4.0,  cachedInputTokenCost: null, reasoning: false, selfhostable: false },
      { modelId: "claude-3-opus-20240229",     cleanName: "Claude 3 Opus",      company: "Anthropic", companyCountryCode: "US", vendorRef: "anthropic", regionCode: "global", sourceCatalog: "duksh-models" as const, sourceVersion: "test", effectiveAt: "2026-03-01", pricingUnit: "1M_tokens" as const, pricingSourceType: "verified" as const, inputTokenCost: 15.0, outputTokenCost: 75.0, cachedInputTokenCost: null, reasoning: false, selfhostable: false },
    ];

    const { records, unpricedModelIds, warnings } = normalizeUsageRecords(usage, {
      providerId:         "anthropic",
      displayName:        "Anthropic API",
      pricingCatalog:     catalog,
      billingPeriodStart: PERIOD_START,
      billingPeriodEnd:   PERIOD_END,
      sourceSystem:       "ficecal-billing-anthropic-deterministic",
      ingestedAt:         "2026-03-01T00:00:00.000Z",
    });

    // All 3 models priced
    expect(records).toHaveLength(3);
    expect(unpricedModelIds).toHaveLength(0);
    expect(warnings).toHaveLength(0);

    // All records are partial (usage-API only)
    for (const r of records) {
      expect(r.dataCompleteness).toBe("partial");
      expect(r.serviceCategory).toBe("AI and Machine Learning");
      expect(r.resourceType).toBe("foundation-model");
      expect(parseFloat(r.amount)).toBeGreaterThan(0);
    }

    // Sonnet should be most expensive (high rate + high volume)
    const sonnet = records.find((r) => r.resourceId === "claude-3-5-sonnet-20241022")!;
    const haiku  = records.find((r) => r.resourceId === "claude-3-5-haiku-20241022")!;
    expect(parseFloat(sonnet.amount)).toBeGreaterThan(parseFloat(haiku.amount));
  });

  it("alibabaAdapter fixture → normalizeUsageRecords → all records in USD", async () => {
    const usage = await alibabaAdapter.fetchUsage(PERIOD_START, PERIOD_END, CREDS);
    const catalog = [
      { modelId: "qwen-max",   cleanName: "Qwen Max",   company: "Alibaba Cloud", companyCountryCode: "CN", vendorRef: "alibaba", regionCode: "global", sourceCatalog: "duksh-models" as const, sourceVersion: "test", effectiveAt: "2026-03-01", pricingUnit: "1M_tokens" as const, pricingSourceType: "verified" as const, inputTokenCost: 0.04, outputTokenCost: 0.12, reasoning: false, selfhostable: false },
      { modelId: "qwen-plus",  cleanName: "Qwen Plus",  company: "Alibaba Cloud", companyCountryCode: "CN", vendorRef: "alibaba", regionCode: "global", sourceCatalog: "duksh-models" as const, sourceVersion: "test", effectiveAt: "2026-03-01", pricingUnit: "1M_tokens" as const, pricingSourceType: "verified" as const, inputTokenCost: 0.012, outputTokenCost: 0.036, reasoning: false, selfhostable: false },
      { modelId: "qwen-turbo", cleanName: "Qwen Turbo", company: "Alibaba Cloud", companyCountryCode: "CN", vendorRef: "alibaba", regionCode: "global", sourceCatalog: "duksh-models" as const, sourceVersion: "test", effectiveAt: "2026-03-01", pricingUnit: "1M_tokens" as const, pricingSourceType: "verified" as const, inputTokenCost: 0.004, outputTokenCost: 0.012, reasoning: false, selfhostable: false },
    ];

    const { records } = normalizeUsageRecords(usage, {
      providerId:         "alibaba",
      displayName:        "Alibaba DashScope API",
      pricingCatalog:     catalog,
      billingPeriodStart: PERIOD_START,
      billingPeriodEnd:   PERIOD_END,
      sourceSystem:       "ficecal-billing-alibaba-deterministic",
      ingestedAt:         "2026-03-01T00:00:00.000Z",
    });

    for (const r of records) {
      expect(r.currency).toBe("USD");
      expect(r.providerRole).toBe("direct-provider");
    }
  });
});
