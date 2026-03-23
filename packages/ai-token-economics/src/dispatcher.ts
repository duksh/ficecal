import { computeTokenCost, computeImageCost, computeRequestCost, computeTimeCost, computeGpuCost } from "./compute.js";
import type { AiCostInput, AiCostResult } from "./types.js";

/**
 * Unified dispatcher for AI pricing unit cost computation.
 *
 * Routes the input to the correct compute function based on `pricingUnit`:
 *
 * | pricingUnit      | compute path              |
 * |------------------|---------------------------|
 * | per_token        | computeTokenCost          |
 * | per_1k_tokens    | computeTokenCost          |
 * | per_1m_tokens    | computeTokenCost          |
 * | per_image        | computeImageCost (Gap 1)  |
 * | per_request      | computeRequestCost        |
 * | per_second       | computeTimeCost           |
 * | per_gpu_hour     | computeGpuCost            |
 *
 * This is an exhaustive discriminated-union dispatch — TypeScript will
 * error at compile time if a new `AiPricingUnit` is added without a
 * corresponding branch.
 */
export function computeAiCost(input: AiCostInput): AiCostResult {
  switch (input.pricingUnit) {
    case "per_token":
    case "per_1k_tokens":
    case "per_1m_tokens":
      return computeTokenCost(input);

    case "per_image":
      return computeImageCost(input);

    case "per_request":
      return computeRequestCost(input);

    case "per_second":
      return computeTimeCost(input);

    case "per_gpu_hour":
      return computeGpuCost(input);

    default: {
      // Exhaustiveness check — this branch is unreachable if all cases are handled.
      const _exhaustive: never = input;
      throw new Error(`Unhandled pricingUnit: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
