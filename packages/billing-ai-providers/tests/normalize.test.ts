// ─── normalize.test.ts ────────────────────────────────────────────────────────
//
// Unit tests for normalizeUsageRecords():
//   - cost calculation formula (tokens / 1_000_000 * ratePerMillion)
//   - cached input tokens included when present
//   - unpriced models → amount "0.0000000000" + warning
//   - FOCUS 1.3 field population
//   - provider role resolution (direct vs service provider)
//   - multiple records in one pass

import { describe, it, expect } from "vitest";
import { normalizeUsageRecords } from "../src/normalize.js";
import type { NormalizeOptions } from "../src/normalize.js";
import type { ProviderUsageRecord } from "../src/interface.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePricing(
  modelId: string,
  company: string,
  inputTokenCost: number,
  outputTokenCost: number,
  cachedInputTokenCost?: number,
): ModelPricingReference {
  return {
    modelId,
    cleanName:          modelId,
    company,
    companyCountryCode: "US",
    vendorRef:          company.toLowerCase(),
    regionCode:         "global",
    sourceCatalog:      "duksh-models",
    sourceVersion:      "test@2026-03-01",
    effectiveAt:        "2026-03-01",
    pricingUnit:        "1M_tokens",
    pricingSourceType:  "verified",
    priceVerifiedAt:    "2026-03-01",
    inputTokenCost,
    outputTokenCost,
    cachedInputTokenCost: cachedInputTokenCost ?? null,
    reasoning:          false,
    selfhostable:       false,
  };
}

function makeUsage(overrides: Partial<ProviderUsageRecord> & { modelId: string }): ProviderUsageRecord {
  return {
    inputTokens:  1_000_000,
    outputTokens: 500_000,
    currency:     "USD",
    periodStart:  "2026-02-01",
    periodEnd:    "2026-02-28",
    ...overrides,
  };
}

const INGEST_AT = "2026-03-01T00:00:00.000Z";

function makeOptions(
  providerId: string,
  catalog: ModelPricingReference[],
  overrides: Partial<NormalizeOptions> = {},
): NormalizeOptions {
  return {
    providerId,
    displayName:        `${providerId} API`,
    pricingCatalog:     catalog,
    billingPeriodStart: "2026-02-01",
    billingPeriodEnd:   "2026-02-28",
    sourceSystem:       `ficecal-billing-${providerId}-deterministic`,
    ingestedAt:         INGEST_AT,
    ...overrides,
  };
}

// ─── Cost calculation ─────────────────────────────────────────────────────────

describe("normalizeUsageRecords — cost calculation", () => {
  const catalog = [makePricing("gpt-4o", "OpenAI", 2.5, 10.0)];
  const opts = makeOptions("openai", catalog);

  it("computes correct cost: (inputTokens / 1M * inputRate) + (outputTokens / 1M * outputRate)", () => {
    const usage = makeUsage({ modelId: "gpt-4o", inputTokens: 1_000_000, outputTokens: 1_000_000 });
    const { records } = normalizeUsageRecords([usage], opts);
    // 1M input * $2.5/M + 1M output * $10/M = $2.5 + $10 = $12.5
    expect(parseFloat(records[0]!.amount)).toBeCloseTo(12.5, 6);
  });

  it("amount is formatted to 10 decimal places", () => {
    const usage = makeUsage({ modelId: "gpt-4o", inputTokens: 500_000, outputTokens: 200_000 });
    const { records } = normalizeUsageRecords([usage], opts);
    expect(records[0]!.amount).toMatch(/^\d+\.\d{10}$/);
  });

  it("billedCost equals amount", () => {
    const usage = makeUsage({ modelId: "gpt-4o" });
    const { records } = normalizeUsageRecords([usage], opts);
    expect(records[0]!.billedCost).toBe(records[0]!.amount);
  });

  it("effectiveCost equals amount", () => {
    const usage = makeUsage({ modelId: "gpt-4o" });
    const { records } = normalizeUsageRecords([usage], opts);
    expect(records[0]!.effectiveCost).toBe(records[0]!.amount);
  });

  it("uses Anthropic pricing: claude-3-5-sonnet $3/$15 per 1M", () => {
    const anthCatalog = [makePricing("claude-3-5-sonnet-20241022", "Anthropic", 3.0, 15.0)];
    const anthOpts = makeOptions("anthropic", anthCatalog);
    // 14.8M input + 2.1M output
    const usage = makeUsage({ modelId: "claude-3-5-sonnet-20241022", inputTokens: 14_800_000, outputTokens: 2_100_000 });
    const { records } = normalizeUsageRecords([usage], anthOpts);
    // 14.8 * $3 + 2.1 * $15 = $44.4 + $31.5 = $75.9
    expect(parseFloat(records[0]!.amount)).toBeCloseTo(75.9, 4);
  });

  it("handles zero input tokens", () => {
    const usage = makeUsage({ modelId: "gpt-4o", inputTokens: 0, outputTokens: 1_000_000 });
    const { records } = normalizeUsageRecords([usage], opts);
    // 0 * $2.5 + 1 * $10 = $10
    expect(parseFloat(records[0]!.amount)).toBeCloseTo(10.0, 6);
  });

  it("handles zero output tokens", () => {
    const usage = makeUsage({ modelId: "gpt-4o", inputTokens: 1_000_000, outputTokens: 0 });
    const { records } = normalizeUsageRecords([usage], opts);
    // 1 * $2.5 + 0 = $2.5
    expect(parseFloat(records[0]!.amount)).toBeCloseTo(2.5, 6);
  });
});

// ─── Cached input tokens ──────────────────────────────────────────────────────

describe("normalizeUsageRecords — cached input tokens", () => {
  it("includes cached cost when both cachedInputTokens and cachedInputTokenCost are present", () => {
    const catalog = [makePricing("claude-3-5-sonnet-20241022", "Anthropic", 3.0, 15.0, 0.3)];
    const opts = makeOptions("anthropic", catalog);
    const usage = makeUsage({
      modelId:           "claude-3-5-sonnet-20241022",
      inputTokens:       1_000_000,
      outputTokens:      0,
      cachedInputTokens: 2_000_000,
    });
    const { records } = normalizeUsageRecords([usage], opts);
    // 1M * $3 + 0 + 2M * $0.3 = $3 + $0.6 = $3.6
    expect(parseFloat(records[0]!.amount)).toBeCloseTo(3.6, 6);
  });

  it("excludes cached cost when pricing.cachedInputTokenCost is null", () => {
    const catalog = [makePricing("claude-3-5-sonnet-20241022", "Anthropic", 3.0, 15.0, undefined)];
    const opts = makeOptions("anthropic", catalog);
    const usage = makeUsage({
      modelId:           "claude-3-5-sonnet-20241022",
      inputTokens:       1_000_000,
      outputTokens:      0,
      cachedInputTokens: 2_000_000,
    });
    const { records } = normalizeUsageRecords([usage], opts);
    // No cached cost applied
    expect(parseFloat(records[0]!.amount)).toBeCloseTo(3.0, 6);
  });
});

// ─── Unpriced models ──────────────────────────────────────────────────────────

describe("normalizeUsageRecords — unpriced models", () => {
  it("returns amount '0.0000000000' when model not in catalog", () => {
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "unknown-model-xyz" })],
      makeOptions("openai", []),
    );
    expect(records[0]!.amount).toBe("0.0000000000");
  });

  it("adds modelId to unpricedModelIds when not found", () => {
    const { unpricedModelIds } = normalizeUsageRecords(
      [makeUsage({ modelId: "mystery-model" })],
      makeOptions("openai", []),
    );
    expect(unpricedModelIds).toContain("mystery-model");
  });

  it("adds warning message for unpriced model", () => {
    const { warnings } = normalizeUsageRecords(
      [makeUsage({ modelId: "mystery-model" })],
      makeOptions("openai", []),
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("mystery-model");
    expect(warnings[0]).toContain("0.0000000000");
  });

  it("still emits a record (partial) for unpriced models", () => {
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "mystery-model" })],
      makeOptions("openai", []),
    );
    expect(records).toHaveLength(1);
  });

  it("separates priced and unpriced in the same run", () => {
    const catalog = [makePricing("gpt-4o", "OpenAI", 2.5, 10.0)];
    const { records, unpricedModelIds, warnings } = normalizeUsageRecords(
      [
        makeUsage({ modelId: "gpt-4o" }),
        makeUsage({ modelId: "mystery-model" }),
      ],
      makeOptions("openai", catalog),
    );
    expect(records).toHaveLength(2);
    expect(unpricedModelIds).toEqual(["mystery-model"]);
    expect(warnings).toHaveLength(1);
    // First record has real cost
    expect(parseFloat(records[0]!.amount)).toBeGreaterThan(0);
    // Second record is zeroed
    expect(records[1]!.amount).toBe("0.0000000000");
  });
});

// ─── FOCUS 1.3 fields ─────────────────────────────────────────────────────────

describe("normalizeUsageRecords — FOCUS 1.3 field population", () => {
  const catalog = [makePricing("gpt-4o", "OpenAI", 2.5, 10.0)];
  const opts = makeOptions("openai", catalog);

  function getRecord() {
    const { records } = normalizeUsageRecords([makeUsage({ modelId: "gpt-4o" })], opts);
    return records[0]!;
  }

  it("serviceCategory is 'AI and Machine Learning'", () => {
    expect(getRecord().serviceCategory).toBe("AI and Machine Learning");
  });

  it("resourceType is 'foundation-model'", () => {
    expect(getRecord().resourceType).toBe("foundation-model");
  });

  it("dataCompleteness is 'partial'", () => {
    expect(getRecord().dataCompleteness).toBe("partial");
  });

  it("pricingCategory is 'standard' (on-demand mapped to FOCUS standard)", () => {
    expect(getRecord().pricingCategory).toBe("standard");
  });

  it("chargeCategory is 'usage'", () => {
    expect(getRecord().chargeCategory).toBe("usage");
  });

  it("chargeFrequency is 'usage-based'", () => {
    expect(getRecord().chargeFrequency).toBe("usage-based");
  });

  it("amountType is 'actual'", () => {
    expect(getRecord().amountType).toBe("actual");
  });

  it("currency defaults to USD", () => {
    expect(getRecord().currency).toBe("USD");
  });

  it("currency propagates from usage record when set", () => {
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "gpt-4o", currency: "EUR" })],
      opts,
    );
    expect(records[0]!.currency).toBe("EUR");
  });

  it("provider is set to the providerId", () => {
    expect(getRecord().provider).toBe("openai");
  });

  it("sourceSystem is set from options", () => {
    expect(getRecord().sourceSystem).toBe("ficecal-billing-openai-deterministic");
  });

  it("ingestedAt matches options", () => {
    expect(getRecord().ingestedAt).toBe(INGEST_AT);
  });

  it("billingPeriodStart and billingPeriodEnd come from options", () => {
    const r = getRecord();
    expect(r.billingPeriodStart).toBe("2026-02-01");
    expect(r.billingPeriodEnd).toBe("2026-02-28");
  });

  it("chargePeriodStart and chargePeriodEnd come from usage record", () => {
    const r = getRecord();
    expect(r.chargePeriodStart).toBe("2026-02-01");
    expect(r.chargePeriodEnd).toBe("2026-02-28");
  });

  it("resourceId is the canonical modelId from the catalog entry", () => {
    // gpt-4o in catalog → resourceId = "gpt-4o"
    expect(getRecord().resourceId).toBe("gpt-4o");
  });

  it("serviceName contains the displayName", () => {
    expect(getRecord().serviceName).toContain("openai");
  });

  it("recordId encodes provider + modelId + period", () => {
    const r = getRecord();
    expect(r.recordId).toContain("openai");
    expect(r.recordId).toContain("gpt-4o");
    expect(r.recordId).toContain("2026-02-01");
  });

  it("schemaVersion is set", () => {
    expect(getRecord().schemaVersion).toBeTruthy();
    expect(typeof getRecord().schemaVersion).toBe("string");
  });
});

// ─── Provider role ────────────────────────────────────────────────────────────

describe("normalizeUsageRecords — provider role", () => {
  const catalog = [
    makePricing("gpt-4o", "OpenAI", 2.5, 10.0),
    makePricing("qwen-max", "Alibaba Cloud", 0.04, 0.12),
  ];

  it("openai → providerRole: service-provider", () => {
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "gpt-4o" })],
      makeOptions("openai", catalog),
    );
    expect(records[0]!.providerRole).toBe("service-provider");
  });

  it("alibaba → providerRole: direct-provider", () => {
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "qwen-max" })],
      makeOptions("alibaba", catalog),
    );
    expect(records[0]!.providerRole).toBe("direct-provider");
  });

  it("anthropic → providerRole: service-provider", () => {
    const anthCatalog = [makePricing("claude-3-5-sonnet-20241022", "Anthropic", 3.0, 15.0)];
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "claude-3-5-sonnet-20241022" })],
      makeOptions("anthropic", anthCatalog),
    );
    expect(records[0]!.providerRole).toBe("service-provider");
  });

  it("gcp → providerRole: direct-provider", () => {
    const gcpCatalog = [makePricing("gemini-2.0-flash", "Google", 0.10, 0.40)];
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "gemini-2.0-flash" })],
      makeOptions("gcp", gcpCatalog),
    );
    expect(records[0]!.providerRole).toBe("direct-provider");
  });
});

// ─── Organisation ID propagation ─────────────────────────────────────────────

describe("normalizeUsageRecords — organizationId propagation", () => {
  it("sets providerAccountId and billingAccountId when organizationId present", () => {
    const catalog = [makePricing("gpt-4o", "OpenAI", 2.5, 10.0)];
    const { records } = normalizeUsageRecords(
      [makeUsage({ modelId: "gpt-4o", organizationId: "org-12345" })],
      makeOptions("openai", catalog),
    );
    const r = records[0]!;
    expect((r as typeof r & { providerAccountId?: string }).providerAccountId).toBe("org-12345");
    expect((r as typeof r & { billingAccountId?: string }).billingAccountId).toBe("org-12345");
  });
});

// ─── Multiple records in one pass ─────────────────────────────────────────────

describe("normalizeUsageRecords — multiple records", () => {
  it("returns one NormalizedCostRecord per ProviderUsageRecord", () => {
    const catalog = [
      makePricing("gpt-4o",      "OpenAI", 2.5,  10.0),
      makePricing("gpt-4o-mini", "OpenAI", 0.15, 0.60),
    ];
    const usage = [
      makeUsage({ modelId: "gpt-4o" }),
      makeUsage({ modelId: "gpt-4o-mini" }),
      makeUsage({ modelId: "unknown-model" }),
    ];
    const { records, unpricedModelIds, warnings } = normalizeUsageRecords(
      usage,
      makeOptions("openai", catalog),
    );
    expect(records).toHaveLength(3);
    expect(unpricedModelIds).toHaveLength(1);
    expect(warnings).toHaveLength(1);
  });

  it("each record has a unique recordId", () => {
    const catalog = [
      makePricing("gpt-4o",      "OpenAI", 2.5,  10.0),
      makePricing("gpt-4o-mini", "OpenAI", 0.15, 0.60),
    ];
    const usage = [
      makeUsage({ modelId: "gpt-4o" }),
      makeUsage({ modelId: "gpt-4o-mini" }),
    ];
    const { records } = normalizeUsageRecords(usage, makeOptions("openai", catalog));
    const ids = records.map((r) => r.recordId);
    expect(new Set(ids).size).toBe(2);
  });
});

// ─── Empty input ──────────────────────────────────────────────────────────────

describe("normalizeUsageRecords — empty input", () => {
  it("returns empty result for empty usage records array", () => {
    const { records, unpricedModelIds, warnings } = normalizeUsageRecords(
      [],
      makeOptions("openai", []),
    );
    expect(records).toHaveLength(0);
    expect(unpricedModelIds).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
