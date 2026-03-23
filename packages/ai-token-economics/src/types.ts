import type { Period } from "@ficecal/core-economics";

// ─── Pricing unit taxonomy ────────────────────────────────────────────────────

/**
 * All AI pricing unit variants supported by FiceCal.
 *
 * Gap 1 close: "per_image" dispatch is implemented in `computeImageCost`.
 */
export type AiPricingUnit =
  | "per_token"       // Input and/or output charged at individual token granularity
  | "per_1k_tokens"   // Charged per thousand tokens (batch rate)
  | "per_1m_tokens"   // Charged per million tokens (batch rate)
  | "per_image"       // Image generation — charged per generated image (Gap 1)
  | "per_request"     // Flat charge per API call, regardless of token count
  | "per_second"      // Compute-time pricing (e.g. streaming inference on some platforms)
  | "per_gpu_hour";  // GPU instance pricing — billed per GPU-hour (training, fine-tuning, dedicated inference)

// ─── Input types ─────────────────────────────────────────────────────────────

/**
 * Cost computation for token-based pricing units.
 * Covers per_token, per_1k_tokens, per_1m_tokens.
 */
export interface TokenCostInput {
  pricingUnit: "per_token" | "per_1k_tokens" | "per_1m_tokens";

  /** Number of input/prompt tokens consumed. */
  inputTokens: number;

  /** Number of output/completion tokens produced. */
  outputTokens: number;

  /**
   * Price per pricing unit for input tokens (decimal string, e.g. "0.000015").
   * For per_1k_tokens this is price per 1,000 tokens.
   * For per_1m_tokens this is price per 1,000,000 tokens.
   */
  inputPricePerUnit: string;

  /**
   * Price per pricing unit for output tokens (decimal string).
   * If omitted, output tokens are charged at the same rate as input tokens.
   */
  outputPricePerUnit?: string;

  /** ISO 4217 currency code (3 chars). */
  currency: string;

  /** Billing period for period-normalization output. */
  period: Period;
}

/**
 * Cost computation for image generation pricing (Gap 1).
 *
 * Covers: DALL-E, Stable Diffusion, Titan Image Generator, etc.
 */
export interface ImageCostInput {
  pricingUnit: "per_image";

  /** Number of images generated. */
  imageCount: number;

  /**
   * Price per image (decimal string, e.g. "0.040").
   * This is the base rate before any resolution or quality multiplier.
   */
  pricePerImage: string;

  /**
   * Optional resolution tier multiplier (decimal string, default "1").
   * Example: HD images at 1.5× base rate → resolutionMultiplier: "1.5"
   */
  resolutionMultiplier?: string;

  /**
   * Optional quality/steps multiplier (decimal string, default "1").
   * Example: 50-step generation at 2× cost → stepsMultiplier: "2"
   */
  stepsMultiplier?: string;

  /** ISO 4217 currency code. */
  currency: string;

  /** Billing period. */
  period: Period;
}

/**
 * Cost computation for per-request pricing.
 * Covers flat API call charges (e.g. Bedrock Converse API flat fee).
 */
export interface RequestCostInput {
  pricingUnit: "per_request";

  /** Number of API requests made. */
  requestCount: number;

  /** Price per request (decimal string). */
  pricePerRequest: string;

  /** ISO 4217 currency code. */
  currency: string;

  /** Billing period. */
  period: Period;
}

/**
 * Cost computation for compute-time pricing.
 * Covers streaming inference billed per second.
 */
export interface TimeCostInput {
  pricingUnit: "per_second";

  /** Total inference seconds consumed. */
  durationSeconds: number;

  /** Price per second (decimal string). */
  pricePerSecond: string;

  /** ISO 4217 currency code. */
  currency: string;

  /** Billing period. */
  period: Period;
}

/**
 * Cost computation for GPU-hour pricing.
 * Covers dedicated GPU instances for training, fine-tuning, and batch inference.
 *
 * @example A100 80GB training run: 24 hours × $3.20/GPU-hour × 8 GPUs = $614.40
 */
export interface GpuCostInput {
  pricingUnit: "per_gpu_hour";

  /** Number of GPU-hours consumed (may be fractional). */
  gpuHours: number;

  /** Number of GPUs in the instance (default 1 for single-GPU inference). */
  gpuCount?: number;

  /** Price per GPU-hour (decimal string, e.g. "3.20"). */
  pricePerGpuHour: string;

  /**
   * Workload type — drives labeling in breakdown; no cost impact.
   * Allows practitioners to distinguish training from inference spend.
   */
  workloadType: "training" | "inference" | "fine-tuning" | "embedding";

  /** GPU model identifier for audit trail (e.g. "A100-80GB", "H100", "T4"). */
  gpuType?: string;

  /** ISO 4217 currency code. */
  currency: string;

  /** Billing period. */
  period: Period;
}

/** Union of all AI cost input shapes. */
export type AiCostInput =
  | TokenCostInput
  | ImageCostInput
  | RequestCostInput
  | TimeCostInput
  | GpuCostInput;

// ─── Output types ─────────────────────────────────────────────────────────────

/** Cost breakdown detail line. */
export interface CostLineItem {
  label: string;
  /** Raw quantity (tokens, images, requests, or seconds). */
  quantity: number;
  /** Unit cost as decimal-safe string. */
  unitCost: string;
  /** Subtotal as decimal-safe string. */
  subtotal: string;
}

/**
 * Unified cost computation result for any AI pricing unit.
 */
export interface AiCostResult {
  /** Effective pricing unit used for this computation. */
  pricingUnit: AiPricingUnit;

  /** Total cost as decimal-safe string (10dp). */
  totalCost: string;

  /** ISO 4217 currency code. */
  currency: string;

  /** Billing period of the input — NOT annualized. */
  period: Period;

  /** Itemized breakdown. Empty for single-rate pricing units. */
  breakdown: CostLineItem[];

  /** Formula IDs applied. */
  formulasApplied: string[];

  /** ISO timestamp. */
  computedAt: string;

  /** Warnings produced during computation. */
  warnings: string[];
}
