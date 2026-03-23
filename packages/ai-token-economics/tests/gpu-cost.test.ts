// tests/gpu-cost.test.ts
// Tests for per_gpu_hour pricing unit
import { describe, it, expect } from "vitest";
import { computeAiCost } from "../src/index.js";

describe("GPU cost (per_gpu_hour)", () => {
  const period = "monthly" as const;

  it("single GPU × 1 hour", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      pricePerGpuHour: "3.20",
      workloadType: "inference",
      currency: "USD",
      period,
    });
    expect(result.totalCost).toBe("3.2000000000");
    expect(result.pricingUnit).toBe("per_gpu_hour");
  });

  it("8 GPUs × 24 hours (training run)", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 24,
      gpuCount: 8,
      pricePerGpuHour: "3.20",
      workloadType: "training",
      gpuType: "A100-80GB",
      currency: "USD",
      period,
    });
    expect(result.totalCost).toBe("614.4000000000");
  });

  it("fractional GPU-hours (30 min)", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 0.5,
      pricePerGpuHour: "2.00",
      workloadType: "embedding",
      currency: "USD",
      period,
    });
    expect(result.totalCost).toBe("1.0000000000");
  });

  it("breakdown label includes workloadType and gpuType", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      gpuCount: 2,
      pricePerGpuHour: "1.00",
      workloadType: "fine-tuning",
      gpuType: "H100",
      currency: "USD",
      period,
    });
    expect(result.breakdown[0]?.label).toContain("fine-tuning");
    expect(result.breakdown[0]?.label).toContain("H100");
  });

  it("formulasApplied contains ai.gpu.cost.v1", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      pricePerGpuHour: "1.00",
      workloadType: "training",
      currency: "USD",
      period,
    });
    expect(result.formulasApplied).toContain("ai.gpu.cost.v1");
  });

  it("breakdown label uses 'GPU' fallback when gpuType is omitted", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 2,
      pricePerGpuHour: "1.50",
      workloadType: "inference",
      currency: "USD",
      period,
    });
    expect(result.breakdown[0]?.label).toContain("GPU");
  });

  it("breakdown quantity equals gpuHours", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 5,
      pricePerGpuHour: "2.00",
      workloadType: "training",
      currency: "USD",
      period,
    });
    expect(result.breakdown[0]?.quantity).toBe(5);
  });

  it("currency is passed through", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      pricePerGpuHour: "1.00",
      workloadType: "inference",
      currency: "EUR",
      period,
    });
    expect(result.currency).toBe("EUR");
  });

  it("period is passed through", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      pricePerGpuHour: "1.00",
      workloadType: "inference",
      currency: "USD",
      period: "annual",
    });
    expect(result.period).toBe("annual");
  });

  it("computedAt is a valid ISO timestamp", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      pricePerGpuHour: "1.00",
      workloadType: "inference",
      currency: "USD",
      period,
    });
    expect(new Date(result.computedAt).toISOString()).toBe(result.computedAt);
  });

  it("warnings array is empty for normal inputs", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      pricePerGpuHour: "1.00",
      workloadType: "inference",
      currency: "USD",
      period,
    });
    expect(result.warnings).toHaveLength(0);
  });

  it("breakdown has exactly one line item", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 3,
      gpuCount: 4,
      pricePerGpuHour: "2.50",
      workloadType: "fine-tuning",
      currency: "USD",
      period,
    });
    expect(result.breakdown).toHaveLength(1);
  });

  it("default gpuCount of 1 when not specified", () => {
    const result1 = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 10,
      pricePerGpuHour: "2.00",
      workloadType: "training",
      currency: "USD",
      period,
    });
    const result2 = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 10,
      gpuCount: 1,
      pricePerGpuHour: "2.00",
      workloadType: "training",
      currency: "USD",
      period,
    });
    expect(result1.totalCost).toBe(result2.totalCost);
  });

  it("T4 embedding workload label", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 1,
      gpuCount: 1,
      pricePerGpuHour: "0.50",
      workloadType: "embedding",
      gpuType: "T4",
      currency: "USD",
      period,
    });
    expect(result.breakdown[0]?.label).toContain("embedding");
    expect(result.breakdown[0]?.label).toContain("T4");
  });

  it("large training run — 100 GPUs × 168 hours (1 week)", () => {
    const result = computeAiCost({
      pricingUnit: "per_gpu_hour",
      gpuHours: 168,
      gpuCount: 100,
      pricePerGpuHour: "3.20",
      workloadType: "training",
      gpuType: "H100",
      currency: "USD",
      period,
    });
    // 168 × 100 × 3.20 = 53760
    expect(result.totalCost).toBe("53760.0000000000");
  });
});
