/**
 * model-catalog contracts
 *
 * Canonical type definitions for AI model pricing references consumed
 * by FiceCal v2's economics and recommendation modules.
 *
 * Source: packages/schemas/model-catalog/index.ts
 */

// ─── Benchmark gate ──────────────────────────────────────────────────────────

/**
 * Approved benchmark keys. Only these keys are permitted in
 * ModelPricingReference.benchmarkScores. Additions require a PR
 * to this file plus a plan amendment note.
 */
export const APPROVED_BENCHMARKS = [
  "swe_bench_verified",
  "mmlu",
  "humaneval",
  "gpqa_diamond",
  "math_500",
  "aime_2024",
] as const;

export type ApprovedBenchmarkKey = (typeof APPROVED_BENCHMARKS)[number];

// ─── Enums ───────────────────────────────────────────────────────────────────

/** Where the price data originated. */
export type PricingSourceType = "dynamic" | "hardcoded" | "verified";

/**
 * Unit in which the model charges.
 * Token-based models: "1K_tokens" | "1M_tokens"
 * Image generation models: "per_image"
 */
export type PricingUnit = "1K_tokens" | "1M_tokens" | "per_image";

/** Which upstream catalog provided this record. */
export type SourceCatalog = "duksh-models";

// ─── Core contract ───────────────────────────────────────────────────────────

/**
 * Canonical AI model pricing reference used across FiceCal v2 modules.
 *
 * One record = one model × one vendor × one region.
 * Image models use imageOutputCost + resolution; token models use
 * inputTokenCost + outputTokenCost.
 *
 * Rules:
 * - Token cost fields MUST be absent when pricingUnit === "per_image"
 * - imageOutputCost MUST be present when pricingUnit === "per_image"
 * - benchmarkScores MUST only contain APPROVED_BENCHMARKS keys
 * - pricingSourceType drives UI badge and comparison trust level
 */
export type ModelPricingReference = {
  // ── Identity ──────────────────────────────────────────────────────────────
  modelId: string; // slug, e.g. "gpt-4o"
  cleanName: string; // display name, e.g. "GPT-4o"
  company: string; // provider company, e.g. "OpenAI"
  companyCountryCode: string; // ISO 3166-1 alpha-2
  vendorRef: string; // cloud vendor, e.g. "azure", "aws", "openai"
  regionCode: string; // vendor region, e.g. "eastus", "us-east-1", "global"

  // ── Provenance ────────────────────────────────────────────────────────────
  sourceCatalog: SourceCatalog;
  /** sha256(data.json)[0:12]@YYYY-MM-DD — content-addressed snapshot id */
  sourceVersion: string;
  /** ISO date when the upstream catalog was ingested */
  effectiveAt: string;

  // ── Pricing ───────────────────────────────────────────────────────────────
  pricingUnit: PricingUnit;
  pricingSourceType: PricingSourceType;
  /** ISO date string — only set when pricingSourceType === "hardcoded" */
  priceVerifiedAt?: string;

  // Token-based pricing (present when pricingUnit !== "per_image")
  inputTokenCost?: number; // cost per token
  outputTokenCost?: number; // cost per token
  cachedInputTokenCost?: number | null;
  cachedOutputTokenCost?: number | null;

  // Image pricing (present when pricingUnit === "per_image")
  imageOutputCost?: number; // cost per image
  resolution?: string; // e.g. "1024x1024"

  // ── Capabilities ─────────────────────────────────────────────────────────
  maxInputTokens?: number;
  maxOutputTokens?: number;
  reasoning: boolean;
  /**
   * Reasoning tier label for models with tiered reasoning capabilities.
   * E.g. "basic", "standard", "advanced", "extended".
   * Only present when reasoning === true and the model exposes tiers.
   */
  reasoningTier?: string;
  /** ISO date string (YYYY-MM-DD) for the model's training data cutoff. */
  trainingCutoff?: string;
  selfhostable: boolean;

  // ── Benchmarks ───────────────────────────────────────────────────────────
  /** Only APPROVED_BENCHMARKS keys permitted. Stripped at ingestion. */
  benchmarkScores?: Partial<Record<ApprovedBenchmarkKey, number>>;
};

// ─── Adapter output ──────────────────────────────────────────────────────────

/** Result envelope returned by the duksh-models-adapter. */
export type ModelCatalogIngestResult = {
  sourceVersion: string;
  ingestedAt: string; // ISO timestamp
  records: ModelPricingReference[];
  /** Number of records skipped due to missing required fields */
  skippedCount: number;
  /** Number of benchmark keys stripped (not in APPROVED_BENCHMARKS) */
  strippedBenchmarkCount: number;
  warnings: string[];
};

// ─── Image model pricing reference ───────────────────────────────────────────

/**
 * Pricing reference for image generation models.
 *
 * One record = one model × one vendor × one region.
 * Pricing is per resolution tier, not per token.
 */
export type ImageModelPricingReference = {
  // ── Identity ──────────────────────────────────────────────────────────────
  modelId: string;       // slug, e.g. "dall-e-3"
  cleanName: string;     // display name, e.g. "DALL-E 3"
  company: string;       // provider company, e.g. "OpenAI"
  companyCountryCode: string; // ISO 3166-1 alpha-2
  vendorRef: string;     // cloud vendor, e.g. "openai", "azure", "aws"
  regionCode: string;    // vendor region, e.g. "global", "eastus"

  // ── Provenance ────────────────────────────────────────────────────────────
  sourceCatalog: SourceCatalog;
  /** sha256(data.json)[0:12]@YYYY-MM-DD — content-addressed snapshot id */
  sourceVersion: string;
  /** ISO date when the upstream catalog was ingested */
  effectiveAt: string;
  /** ISO date when pricing was last human-verified */
  priceVerifiedAt: string;
  pricingSourceType: PricingSourceType;

  // ── Pricing tiers (per resolution) ───────────────────────────────────────
  /**
   * Resolution-based pricing tiers. Each entry covers one output resolution.
   * At least one tier must be present.
   */
  pricingTiers: Array<{
    /** Output resolution, e.g. "1024x1024", "1792x1024", "256x256". */
    resolution: string;
    /** Cost per generated image in USD. */
    pricePerImage: number;
    /** Approximate generation time in milliseconds, if known. */
    generationSpeedMs?: number;
  }>;

  // ── Capabilities ─────────────────────────────────────────────────────────
  /** Whether the model accepts a negative prompt to exclude content. */
  supportsNegativePrompts: boolean;
  selfhostable: boolean;
};

// ─── GPU model pricing reference ─────────────────────────────────────────────

/**
 * Pricing reference for GPU-based models (training, fine-tuning, inference).
 *
 * One record = one GPU type × one vendor × one region × one workload type.
 */
export type GpuModelPricingReference = {
  // ── Identity ──────────────────────────────────────────────────────────────
  modelId: string;   // slug identifying the GPU configuration, e.g. "a100-40gb-inference"
  cleanName: string; // display name, e.g. "A100 40GB — Inference"
  company: string;   // vendor company, e.g. "NVIDIA", "Google", "AWS"
  vendorRef: string; // cloud vendor, e.g. "aws", "gcp", "azure", "lambda-labs"
  regionCode: string; // vendor region, e.g. "us-east-1", "us-central1"

  // ── Provenance ────────────────────────────────────────────────────────────
  sourceCatalog: SourceCatalog;
  /** sha256(data.json)[0:12]@YYYY-MM-DD — content-addressed snapshot id */
  sourceVersion: string;
  /** ISO date when the upstream catalog was ingested */
  effectiveAt: string;
  pricingSourceType: PricingSourceType;

  // ── GPU pricing ───────────────────────────────────────────────────────────
  /** Cost in USD per GPU-hour. */
  costPerGpuHour: number;
  /** GPU model identifier. E.g. "A100", "H100", "T4", "L4", "V100". */
  gpuType: string;
  /** GPU memory in gigabytes. E.g. 40, 80, 16. */
  gpuMemoryGb: number;
  /**
   * Cloud instance type backing this GPU, if applicable.
   * E.g. "p4d.24xlarge" (AWS), "a2-highgpu-1g" (GCP).
   */
  instanceType?: string;

  // ── Workload distinction ──────────────────────────────────────────────────
  /** The intended workload category for this pricing record. */
  workloadType: "training" | "inference" | "fine-tuning" | "embedding";
  /**
   * The unit basis for pricing.
   * - "per_gpu_hour"      : billed per individual GPU per hour
   * - "per_instance_hour" : billed per instance (may contain multiple GPUs)
   */
  pricingUnit: "per_gpu_hour" | "per_instance_hour";
};
