// ─── Carbon Economics — Type definitions ─────────────────────────────────────
//
// FOCUS 1.3 FinOps Framework 2026 Sustainability capability.
// Carbon intensity sourced from cloud provider sustainability reports and
// Electricity Maps API (future integration). Current implementation uses
// static regional intensity factors.

import type Decimal from "decimal.js";
export type { Decimal };

// ─── Carbon intensity ─────────────────────────────────────────────────────────

/**
 * Carbon intensity for a cloud region.
 * Unit: gCO2e / kWh (grams of CO2 equivalent per kilowatt-hour)
 */
export interface RegionCarbonIntensity {
  /** Cloud provider (aws, gcp, azure, etc.) */
  provider: string;
  /** Region code (e.g. "us-east-1", "europe-west1") */
  regionCode: string;
  /** Human-readable region name */
  regionName: string;
  /** gCO2e per kWh */
  intensityGCo2ePerKwh: number;
  /** Source of intensity data */
  source: "provider-report" | "electricity-maps" | "static-estimate";
  /** Whether this region uses renewable energy commitments */
  renewableCommitment: boolean;
  /** Year of data */
  dataYear: number;
}

// ─── Workload carbon profiles ─────────────────────────────────────────────────

export type WorkloadType = "inference" | "training" | "fine-tuning" | "embedding" | "storage" | "networking";

/**
 * Power consumption profile for a workload type.
 * Used to estimate energy consumption from compute hours.
 */
export interface WorkloadPowerProfile {
  workloadType: WorkloadType;
  /** Average power draw in Watts per compute unit */
  avgWattsPerUnit: number;
  /** Compute unit (e.g. "gpu-hour", "cpu-hour", "token-1m") */
  computeUnit: string;
  /** PUE (Power Usage Effectiveness) typical for cloud DCs (default 1.2) */
  pueMultiplier: number;
}

// ─── Carbon estimate input/output ─────────────────────────────────────────────

export interface CarbonEstimateInput {
  /** Cloud provider */
  provider: string;
  /** Cloud region code */
  regionCode: string;
  /** Workload type */
  workloadType: WorkloadType;
  /** Number of compute units consumed */
  quantity: number;
  /** Compute unit type (e.g. "gpu-hour", "cpu-hour") */
  computeUnit: string;
  /**
   * Override intensity in gCO2e/kWh (skip catalog lookup).
   * Useful for testing or when you have more precise data.
   */
  intensityOverride?: number;
  /** Billing period for context */
  periodStart: string;
  periodEnd: string;
}

export interface CarbonEstimateOutput {
  /** Provider + region */
  provider: string;
  regionCode: string;
  regionName: string;
  workloadType: WorkloadType;

  /** Energy consumed in kWh (decimal-safe string, 10dp) */
  energyKwh: string;
  /** Carbon emitted in kg CO2e (decimal-safe string, 10dp) */
  carbonKgCo2e: string;
  /** Carbon emitted in metric tonnes CO2e (decimal-safe string, 10dp) */
  carbonTonnesCo2e: string;

  /** Carbon intensity used (gCO2e/kWh) */
  intensityGCo2ePerKwh: number;
  /** PUE multiplier applied */
  pueMultiplier: number;
  /** Whether region has renewable energy commitment */
  renewableCommitment: boolean;

  /** Equivalent car km driven (rough equivalence for communication, 120g CO2/km) */
  equivalentCarKm: string;

  /** Source of intensity data */
  intensitySource: string;

  /** Formulas applied */
  formulasApplied: string[];
  computedAt: string;
  warnings: string[];
}
