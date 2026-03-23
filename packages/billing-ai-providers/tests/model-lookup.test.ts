// ─── model-lookup.test.ts ─────────────────────────────────────────────────────
//
// Unit tests for lookupModelPricing() — the 4-pass fuzzy ModelPricingReference
// resolver. Tests cover exact match, fuzzy match, region preference, image
// model exclusion, and null returns for unrecognised models.

import { describe, it, expect } from "vitest";
import { lookupModelPricing } from "../src/model-lookup.js";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makePricing(overrides: Partial<ModelPricingReference> & {
  modelId: string;
  cleanName: string;
  company: string;
}): ModelPricingReference {
  return {
    companyCountryCode: "US",
    vendorRef:          overrides.company?.toLowerCase() ?? "test",
    regionCode:         "global",
    sourceCatalog:      "duksh-models",
    sourceVersion:      "abc123@2026-03-01",
    effectiveAt:        "2026-03-01",
    pricingUnit:        "1M_tokens",
    pricingSourceType:  "verified",
    inputTokenCost:     3.0,
    outputTokenCost:    15.0,
    reasoning:          false,
    selfhostable:       false,
    ...overrides,
  };
}

// Catalog that mirrors common real-world model IDs from ficecal-model-lens
const CATALOG: ModelPricingReference[] = [
  // ── Anthropic ────────────────────────────────────────────────────────────
  makePricing({ modelId: "claude-3-5-sonnet-20241022", cleanName: "Claude 3.5 Sonnet", company: "Anthropic", regionCode: "global", inputTokenCost: 3.0,   outputTokenCost: 15.0 }),
  makePricing({ modelId: "claude-3-5-haiku-20241022",  cleanName: "Claude 3.5 Haiku",  company: "Anthropic", regionCode: "global", inputTokenCost: 0.8,   outputTokenCost: 4.0  }),
  makePricing({ modelId: "claude-3-opus-20240229",     cleanName: "Claude 3 Opus",      company: "Anthropic", regionCode: "global", inputTokenCost: 15.0,  outputTokenCost: 75.0 }),
  // same model in us-east-1
  makePricing({ modelId: "claude-3-5-sonnet-20241022", cleanName: "Claude 3.5 Sonnet", company: "Anthropic", regionCode: "us-east-1", inputTokenCost: 3.0, outputTokenCost: 15.0 }),

  // ── OpenAI ───────────────────────────────────────────────────────────────
  makePricing({ modelId: "gpt-4o",      cleanName: "GPT-4o",      company: "OpenAI", inputTokenCost: 2.5,  outputTokenCost: 10.0 }),
  makePricing({ modelId: "gpt-4o-mini", cleanName: "GPT-4o Mini", company: "OpenAI", inputTokenCost: 0.15, outputTokenCost: 0.60 }),
  makePricing({ modelId: "o1",          cleanName: "O1",           company: "OpenAI", inputTokenCost: 15.0, outputTokenCost: 60.0 }),

  // ── Google ───────────────────────────────────────────────────────────────
  makePricing({ modelId: "gemini-2.0-flash",  cleanName: "Gemini 2.0 Flash",  company: "Google",         inputTokenCost: 0.10, outputTokenCost: 0.40 }),
  makePricing({ modelId: "gemini-1.5-pro",    cleanName: "Gemini 1.5 Pro",    company: "Google",         inputTokenCost: 1.25, outputTokenCost: 5.0  }),
  makePricing({ modelId: "gemini-1.5-flash",  cleanName: "Gemini 1.5 Flash",  company: "Google",         inputTokenCost: 0.075, outputTokenCost: 0.30 }),

  // ── Mistral ──────────────────────────────────────────────────────────────
  makePricing({ modelId: "mistral-large-latest", cleanName: "Mistral Large",  company: "Mistral AI", inputTokenCost: 2.0, outputTokenCost: 6.0 }),
  makePricing({ modelId: "codestral-latest",     cleanName: "Codestral",      company: "Mistral AI", inputTokenCost: 1.0, outputTokenCost: 3.0 }),
  makePricing({ modelId: "mistral-small-latest", cleanName: "Mistral Small",  company: "Mistral AI", inputTokenCost: 0.2, outputTokenCost: 0.6 }),

  // ── DeepSeek ─────────────────────────────────────────────────────────────
  makePricing({ modelId: "deepseek-chat",     cleanName: "DeepSeek V3", company: "DeepSeek", inputTokenCost: 0.27, outputTokenCost: 1.1  }),
  makePricing({ modelId: "deepseek-reasoner", cleanName: "DeepSeek R1", company: "DeepSeek", inputTokenCost: 0.55, outputTokenCost: 2.19 }),

  // ── Alibaba ──────────────────────────────────────────────────────────────
  makePricing({ modelId: "qwen-max",   cleanName: "Qwen Max",   company: "Alibaba Cloud", inputTokenCost: 0.04, outputTokenCost: 0.12 }),
  makePricing({ modelId: "qwen-plus",  cleanName: "Qwen Plus",  company: "Alibaba Cloud", inputTokenCost: 0.012, outputTokenCost: 0.036 }),
  makePricing({ modelId: "qwen-turbo", cleanName: "Qwen Turbo", company: "Alibaba Cloud", inputTokenCost: 0.004, outputTokenCost: 0.012 }),

  // ── Image model (should be excluded from token lookups) ──────────────────
  makePricing({ modelId: "dall-e-3", cleanName: "DALL-E 3", company: "OpenAI", pricingUnit: "per_image", imageOutputCost: 0.04, inputTokenCost: undefined, outputTokenCost: undefined }),
];

// ─── Pass 1: exact modelId + company match ────────────────────────────────────

describe("lookupModelPricing — Pass 1: exact modelId + company", () => {
  it("returns exact match for Anthropic model with date suffix", () => {
    const result = lookupModelPricing("claude-3-5-sonnet-20241022", "anthropic", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("claude-3-5-sonnet-20241022");
    expect(result!.company).toBe("Anthropic");
  });

  it("returns exact match for OpenAI gpt-4o", () => {
    const result = lookupModelPricing("gpt-4o", "openai", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("gpt-4o");
    expect(result!.company).toBe("OpenAI");
  });

  it("returns exact match for DeepSeek reasoner", () => {
    const result = lookupModelPricing("deepseek-reasoner", "deepseek", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("deepseek-reasoner");
    expect(result!.company).toBe("DeepSeek");
  });

  it("returns exact match for Alibaba qwen-max", () => {
    const result = lookupModelPricing("qwen-max", "alibaba", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("qwen-max");
    expect(result!.company).toMatch(/Alibaba/);
  });
});

// ─── Region preference ────────────────────────────────────────────────────────

describe("lookupModelPricing — region preference", () => {
  it("prefers exact region when multiple records for same model exist", () => {
    const result = lookupModelPricing("claude-3-5-sonnet-20241022", "anthropic", CATALOG, "us-east-1");
    expect(result).not.toBeNull();
    expect(result!.regionCode).toBe("us-east-1");
  });

  it("falls back to global when requested region not present", () => {
    const result = lookupModelPricing("claude-3-5-sonnet-20241022", "anthropic", CATALOG, "eu-west-1");
    expect(result).not.toBeNull();
    expect(result!.regionCode).toBe("global");
  });

  it("returns global when no region specified and multiple regions exist", () => {
    const result = lookupModelPricing("claude-3-5-sonnet-20241022", "anthropic", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.regionCode).toBe("global");
  });
});

// ─── Date suffix stripping ────────────────────────────────────────────────────

describe("lookupModelPricing — date suffix stripping via slugify", () => {
  it("matches model with date suffix in catalog entry", () => {
    // Adapter emits "claude-3-5-sonnet-20241022"; catalog has same ID; slugify strips date
    const result = lookupModelPricing("claude-3-5-sonnet-20241022", "anthropic", CATALOG);
    expect(result).not.toBeNull();
  });

  it("matches when caller omits date suffix that catalog entry has", () => {
    // If provider returns "claude-3-5-haiku" without date, slugify on both sides strips it
    const result = lookupModelPricing("claude-3-5-haiku", "anthropic", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.cleanName).toContain("Haiku");
  });
});

// ─── Pass 2: exact modelId, any vendor ───────────────────────────────────────

describe("lookupModelPricing — Pass 2: exact modelId any vendor", () => {
  it("finds model when providerId is unknown but modelId matches", () => {
    // Use an unknown provider — company map returns []
    const result = lookupModelPricing("gpt-4o", "unknown-provider", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("gpt-4o");
  });
});

// ─── Pass 3 / 4: fuzzy matching ──────────────────────────────────────────────

describe("lookupModelPricing — fuzzy matching (Pass 3/4)", () => {
  it("Pass 3: finds model when cleanName slug contains raw model slug", () => {
    // "Mistral Large" cleanName slug = "mistral-large" which contains "mistral-large"
    const result = lookupModelPricing("mistral-large", "mistral", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.cleanName).toMatch(/Mistral Large/i);
  });

  it("Pass 4: finds model when raw slug contains cleanName slug", () => {
    // "gemini-2.0-flash-001" raw slug contains "gemini-2-0-flash"
    const result = lookupModelPricing("gemini-2.0-flash-001", "google", CATALOG);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe("gemini-2.0-flash");
  });
});

// ─── Null for unrecognised models ─────────────────────────────────────────────

describe("lookupModelPricing — null returns", () => {
  it("returns null for a model not in catalog", () => {
    const result = lookupModelPricing("completely-unknown-model-xyz", "anthropic", CATALOG);
    expect(result).toBeNull();
  });

  it("returns null for empty catalog", () => {
    const result = lookupModelPricing("gpt-4o", "openai", []);
    expect(result).toBeNull();
  });
});

// ─── Image model exclusion ────────────────────────────────────────────────────

describe("lookupModelPricing — image model exclusion", () => {
  it("does not return per_image records for token-based lookup", () => {
    // DALL-E 3 is in catalog but pricingUnit === "per_image"
    const result = lookupModelPricing("dall-e-3", "openai", CATALOG);
    // Either null or a token-based model — never the image record
    if (result !== null) {
      expect(result.pricingUnit).not.toBe("per_image");
    }
  });
});

// ─── Gemini and Mistral specific ─────────────────────────────────────────────

describe("lookupModelPricing — Gemini models (provider: google)", () => {
  it("matches gemini-2.0-flash", () => {
    const r = lookupModelPricing("gemini-2.0-flash", "google", CATALOG);
    expect(r?.modelId).toBe("gemini-2.0-flash");
  });

  it("matches gemini-1.5-pro", () => {
    const r = lookupModelPricing("gemini-1.5-pro", "google", CATALOG);
    expect(r?.modelId).toBe("gemini-1.5-pro");
  });

  it("matches gemini-1.5-flash", () => {
    const r = lookupModelPricing("gemini-1.5-flash", "google", CATALOG);
    expect(r?.modelId).toBe("gemini-1.5-flash");
  });
});

describe("lookupModelPricing — Mistral models", () => {
  it("matches mistral-large-latest", () => {
    const r = lookupModelPricing("mistral-large-latest", "mistral", CATALOG);
    expect(r?.modelId).toBe("mistral-large-latest");
  });

  it("matches codestral-latest", () => {
    const r = lookupModelPricing("codestral-latest", "mistral", CATALOG);
    expect(r?.modelId).toBe("codestral-latest");
  });

  it("matches mistral-small-latest", () => {
    const r = lookupModelPricing("mistral-small-latest", "mistral", CATALOG);
    expect(r?.modelId).toBe("mistral-small-latest");
  });
});
