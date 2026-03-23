// ─── Carbon Estimate Engine ───────────────────────────────────────────────────

import Decimal from "decimal.js";
import type { CarbonEstimateInput, CarbonEstimateOutput } from "./types.js";
import { lookupRegionIntensity, lookupWorkloadProfile } from "./catalog.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/** gCO2e per km driven by average car */
const CAR_GRAMS_PER_KM = 120;

/**
 * Estimates operational carbon emissions for a cloud workload.
 *
 * Formula:
 *   energyKwh = quantity × avgWattsPerUnit × pueMultiplier / 1000
 *   carbonGrams = energyKwh × intensityGCo2ePerKwh
 *   carbonKg = carbonGrams / 1000
 *
 * @throws Error if region intensity cannot be found and no override provided
 */
export function estimateCarbon(input: CarbonEstimateInput): CarbonEstimateOutput {
  const warnings: string[] = [];

  // ── Intensity lookup ──────────────────────────────────────────────────────
  const regionEntry = lookupRegionIntensity(input.provider, input.regionCode);
  let intensityGCo2ePerKwh: number;
  let intensitySource: string;
  let renewableCommitment = false;
  let regionName = input.regionCode;
  let pueMultiplier = 1.2;

  if (input.intensityOverride !== undefined) {
    intensityGCo2ePerKwh = input.intensityOverride;
    intensitySource = "user-override";
    warnings.push("Using user-provided intensity override; catalog data not consulted.");
  } else if (regionEntry) {
    intensityGCo2ePerKwh = regionEntry.intensityGCo2ePerKwh;
    intensitySource = regionEntry.source;
    renewableCommitment = regionEntry.renewableCommitment;
    regionName = regionEntry.regionName;
  } else {
    intensityGCo2ePerKwh = 475; // world average gCO2e/kWh (IEA 2023)
    intensitySource = "world-average-fallback";
    warnings.push(
      `No regional intensity found for ${input.provider}/${input.regionCode}. ` +
      `Using world average (475 gCO2e/kWh). ` +
      `Provide intensityOverride for a more accurate estimate.`
    );
  }

  // ── Power profile lookup ──────────────────────────────────────────────────
  const profile = lookupWorkloadProfile(input.workloadType, input.computeUnit);
  let avgWatts: number;
  if (profile) {
    avgWatts = profile.avgWattsPerUnit;
    pueMultiplier = profile.pueMultiplier;
  } else {
    avgWatts = 200; // conservative default
    warnings.push(
      `No power profile for workload="${input.workloadType}" unit="${input.computeUnit}". ` +
      `Using 200W default. Accuracy will be low.`
    );
  }

  // ── Energy calculation ────────────────────────────────────────────────────
  // energyKwh = (watts × pue × quantity) / 1000
  const qty       = new Decimal(input.quantity);
  const watts     = new Decimal(avgWatts);
  const pue       = new Decimal(pueMultiplier);
  const energyKwh = qty.mul(watts).mul(pue).div(1000);

  // ── Carbon calculation ────────────────────────────────────────────────────
  const intensity       = new Decimal(intensityGCo2ePerKwh);
  const carbonGrams     = energyKwh.mul(intensity);
  const carbonKg        = carbonGrams.div(1000);
  const carbonTonnes    = carbonKg.div(1000);
  const equivalentCarKm = carbonGrams.div(CAR_GRAMS_PER_KM);

  if (renewableCommitment) {
    warnings.push(
      "This region has a renewable energy commitment. " +
      "Actual net emissions may be lower than the market-based estimate shown."
    );
  }

  return {
    provider:               input.provider,
    regionCode:             input.regionCode,
    regionName,
    workloadType:           input.workloadType,
    energyKwh:              energyKwh.toFixed(10),
    carbonKgCo2e:           carbonKg.toFixed(10),
    carbonTonnesCo2e:       carbonTonnes.toFixed(10),
    intensityGCo2ePerKwh,
    pueMultiplier,
    renewableCommitment,
    equivalentCarKm:        equivalentCarKm.toFixed(10),
    intensitySource,
    formulasApplied:        ["sustainability.carbon.estimate.v1"],
    computedAt:             new Date().toISOString(),
    warnings,
  };
}
