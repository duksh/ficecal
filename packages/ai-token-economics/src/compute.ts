import { Decimal, toOutputString } from "@ficecal/core-economics";
import type {
  AiCostResult,
  CostLineItem,
  GpuCostInput,
  ImageCostInput,
  RequestCostInput,
  TimeCostInput,
  TokenCostInput,
} from "./types.js";

// ─── Token scaling factors ────────────────────────────────────────────────────

const TOKEN_SCALE: Record<"per_token" | "per_1k_tokens" | "per_1m_tokens", string> = {
  per_token: "1",
  per_1k_tokens: "1000",
  per_1m_tokens: "1000000",
};

// ─── Token cost ───────────────────────────────────────────────────────────────

/**
 * Compute cost for token-based pricing.
 *
 * Formula:
 *   inputCost  = inputTokens  / scale × inputPricePerUnit
 *   outputCost = outputTokens / scale × outputPricePerUnit
 *   total      = inputCost + outputCost
 */
export function computeTokenCost(input: TokenCostInput): AiCostResult {
  const warnings: string[] = [];
  const scale = new Decimal(TOKEN_SCALE[input.pricingUnit]);
  const inputPrice = new Decimal(input.inputPricePerUnit);
  const outputPrice =
    input.outputPricePerUnit !== undefined
      ? new Decimal(input.outputPricePerUnit)
      : inputPrice;

  if (input.outputPricePerUnit === undefined) {
    warnings.push(
      "outputPricePerUnit not provided — charging output tokens at the same rate as input tokens.",
    );
  }

  const inputCost = new Decimal(input.inputTokens).div(scale).mul(inputPrice);
  const outputCost = new Decimal(input.outputTokens).div(scale).mul(outputPrice);
  const total = inputCost.add(outputCost);

  const breakdown: CostLineItem[] = [
    {
      label: "Input tokens",
      quantity: input.inputTokens,
      unitCost: toOutputString(inputPrice.div(scale)),
      subtotal: toOutputString(inputCost),
    },
    {
      label: "Output tokens",
      quantity: input.outputTokens,
      unitCost: toOutputString(outputPrice.div(scale)),
      subtotal: toOutputString(outputCost),
    },
  ];

  return {
    pricingUnit: input.pricingUnit,
    totalCost: toOutputString(total),
    currency: input.currency,
    period: input.period,
    breakdown,
    formulasApplied: ["unit.tokenCost"],
    computedAt: new Date().toISOString(),
    warnings,
  };
}

// ─── Image cost (Gap 1 close) ─────────────────────────────────────────────────

/**
 * Compute cost for image generation pricing.
 *
 * Formula:
 *   effectiveRate = pricePerImage × resolutionMultiplier × stepsMultiplier
 *   total         = imageCount × effectiveRate
 *
 * This is the Gap 1 close: routes "per_image" pricingUnit to its own
 * compute path rather than falling through to generic unit cost.
 */
export function computeImageCost(input: ImageCostInput): AiCostResult {
  const warnings: string[] = [];
  const baseRate = new Decimal(input.pricePerImage);
  const resMul =
    input.resolutionMultiplier !== undefined
      ? new Decimal(input.resolutionMultiplier)
      : new Decimal("1");
  const stepsMul =
    input.stepsMultiplier !== undefined
      ? new Decimal(input.stepsMultiplier)
      : new Decimal("1");

  if (resMul.lessThan("1")) {
    warnings.push("resolutionMultiplier is less than 1 — verify this is intentional.");
  }
  if (stepsMul.lessThan("1")) {
    warnings.push("stepsMultiplier is less than 1 — verify this is intentional.");
  }

  const effectiveRate = baseRate.mul(resMul).mul(stepsMul);
  const total = new Decimal(input.imageCount).mul(effectiveRate);

  const breakdown: CostLineItem[] = [
    {
      label: "Images",
      quantity: input.imageCount,
      unitCost: toOutputString(effectiveRate),
      subtotal: toOutputString(total),
    },
  ];

  if (!resMul.equals("1") || !stepsMul.equals("1")) {
    breakdown.push({
      label: "Base rate",
      quantity: 1,
      unitCost: toOutputString(baseRate),
      subtotal: toOutputString(baseRate),
    });
    if (!resMul.equals("1")) {
      breakdown.push({
        label: "Resolution multiplier",
        quantity: 1,
        unitCost: toOutputString(resMul),
        subtotal: toOutputString(resMul),
      });
    }
    if (!stepsMul.equals("1")) {
      breakdown.push({
        label: "Steps multiplier",
        quantity: 1,
        unitCost: toOutputString(stepsMul),
        subtotal: toOutputString(stepsMul),
      });
    }
  }

  return {
    pricingUnit: "per_image",
    totalCost: toOutputString(total),
    currency: input.currency,
    period: input.period,
    breakdown,
    formulasApplied: ["unit.imageCost"],
    computedAt: new Date().toISOString(),
    warnings,
  };
}

// ─── Request cost ─────────────────────────────────────────────────────────────

/**
 * Compute flat per-request pricing.
 *
 * Formula: total = requestCount × pricePerRequest
 */
export function computeRequestCost(input: RequestCostInput): AiCostResult {
  const price = new Decimal(input.pricePerRequest);
  const total = new Decimal(input.requestCount).mul(price);

  const breakdown: CostLineItem[] = [
    {
      label: "API requests",
      quantity: input.requestCount,
      unitCost: toOutputString(price),
      subtotal: toOutputString(total),
    },
  ];

  return {
    pricingUnit: "per_request",
    totalCost: toOutputString(total),
    currency: input.currency,
    period: input.period,
    breakdown,
    formulasApplied: ["unit.requestCost"],
    computedAt: new Date().toISOString(),
    warnings: [],
  };
}

// ─── Time cost ────────────────────────────────────────────────────────────────

/**
 * Compute compute-time pricing.
 *
 * Formula: total = durationSeconds × pricePerSecond
 */
export function computeTimeCost(input: TimeCostInput): AiCostResult {
  const price = new Decimal(input.pricePerSecond);
  const total = new Decimal(input.durationSeconds).mul(price);

  const breakdown: CostLineItem[] = [
    {
      label: "Inference seconds",
      quantity: input.durationSeconds,
      unitCost: toOutputString(price),
      subtotal: toOutputString(total),
    },
  ];

  return {
    pricingUnit: "per_second",
    totalCost: toOutputString(total),
    currency: input.currency,
    period: input.period,
    breakdown,
    formulasApplied: ["unit.timeCost"],
    computedAt: new Date().toISOString(),
    warnings: [],
  };
}

// ─── GPU cost ─────────────────────────────────────────────────────────────────

/**
 * Computes cost for GPU-hour pricing.
 * totalCost = gpuHours × gpuCount × pricePerGpuHour
 */
export function computeGpuCost(input: GpuCostInput): AiCostResult {
  const hours = new Decimal(input.gpuHours);
  const count = new Decimal(input.gpuCount ?? 1);
  const rate  = new Decimal(input.pricePerGpuHour);
  const total = hours.mul(count).mul(rate);

  return {
    pricingUnit:  "per_gpu_hour",
    totalCost:    toOutputString(total),
    currency:     input.currency,
    period:       input.period,
    breakdown: [
      {
        label:    `${input.workloadType} · ${input.gpuType ?? "GPU"} × ${input.gpuCount ?? 1}`,
        quantity: input.gpuHours,
        unitCost: toOutputString(rate),
        subtotal: toOutputString(total),
      },
    ],
    formulasApplied: ["ai.gpu.cost.v1"],
    computedAt:      new Date().toISOString(),
    warnings:        [],
  };
}
