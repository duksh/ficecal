// ─── Regional Carbon Intensity Catalog ───────────────────────────────────────
//
// Sources:
//  - AWS: https://sustainability.aboutamazon.com/environment/the-cloud/carbon-free-energy
//  - GCP: https://cloud.google.com/sustainability/region-carbon
//  - Azure: https://azure.microsoft.com/en-us/blog/empowering-cloud-sustainability-with-the-microsoft-emissions-impact-dashboard/
//
// Intensities in gCO2e/kWh. Static estimates for 2024-2025.
// Phase 12: replace with live Electricity Maps API feed.

import type { RegionCarbonIntensity, WorkloadPowerProfile } from "./types.js";

export const REGION_CARBON_CATALOG: RegionCarbonIntensity[] = [
  // ── AWS ───────────────────────────────────────────────────────────────────
  { provider: "aws", regionCode: "us-east-1",      regionName: "US East (N. Virginia)",    intensityGCo2ePerKwh: 379, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "aws", regionCode: "us-west-2",      regionName: "US West (Oregon)",          intensityGCo2ePerKwh: 120, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "aws", regionCode: "eu-west-1",      regionName: "Europe (Ireland)",          intensityGCo2ePerKwh: 288, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "aws", regionCode: "eu-central-1",   regionName: "Europe (Frankfurt)",        intensityGCo2ePerKwh: 338, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "aws", regionCode: "ap-southeast-1", regionName: "Asia Pacific (Singapore)",  intensityGCo2ePerKwh: 431, source: "static-estimate", renewableCommitment: false, dataYear: 2024 },
  { provider: "aws", regionCode: "ap-northeast-1", regionName: "Asia Pacific (Tokyo)",      intensityGCo2ePerKwh: 506, source: "static-estimate", renewableCommitment: false, dataYear: 2024 },
  // ── GCP ───────────────────────────────────────────────────────────────────
  { provider: "gcp", regionCode: "us-central1",    regionName: "Iowa",                      intensityGCo2ePerKwh: 417, source: "provider-report", renewableCommitment: true,  dataYear: 2024 },
  { provider: "gcp", regionCode: "us-west1",       regionName: "Oregon",                    intensityGCo2ePerKwh: 67,  source: "provider-report", renewableCommitment: true,  dataYear: 2024 },
  { provider: "gcp", regionCode: "europe-west1",   regionName: "Belgium",                   intensityGCo2ePerKwh: 149, source: "provider-report", renewableCommitment: true,  dataYear: 2024 },
  { provider: "gcp", regionCode: "europe-west4",   regionName: "Netherlands",               intensityGCo2ePerKwh: 284, source: "provider-report", renewableCommitment: true,  dataYear: 2024 },
  { provider: "gcp", regionCode: "asia-east1",     regionName: "Taiwan",                    intensityGCo2ePerKwh: 509, source: "provider-report", renewableCommitment: false, dataYear: 2024 },
  // ── Azure ─────────────────────────────────────────────────────────────────
  { provider: "azure", regionCode: "eastus",        regionName: "East US",                  intensityGCo2ePerKwh: 379, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "azure", regionCode: "westus2",       regionName: "West US 2",                intensityGCo2ePerKwh: 130, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "azure", regionCode: "northeurope",   regionName: "North Europe (Ireland)",   intensityGCo2ePerKwh: 288, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  { provider: "azure", regionCode: "westeurope",    regionName: "West Europe (Netherlands)",intensityGCo2ePerKwh: 284, source: "static-estimate", renewableCommitment: true,  dataYear: 2024 },
  // ── AI providers (global/edge — use world average as conservative estimate) ─
  { provider: "anthropic", regionCode: "global",   regionName: "Global (estimated)",        intensityGCo2ePerKwh: 350, source: "static-estimate", renewableCommitment: false, dataYear: 2024 },
  { provider: "openai",    regionCode: "global",   regionName: "Global (estimated)",        intensityGCo2ePerKwh: 350, source: "static-estimate", renewableCommitment: false, dataYear: 2024 },
  { provider: "mistral",   regionCode: "global",   regionName: "Global EU-hosted",          intensityGCo2ePerKwh: 220, source: "static-estimate", renewableCommitment: false, dataYear: 2024 },
  { provider: "deepseek",  regionCode: "global",   regionName: "Global (estimated)",        intensityGCo2ePerKwh: 580, source: "static-estimate", renewableCommitment: false, dataYear: 2024 },
];

/** Workload power profiles — average Watts per compute unit */
export const WORKLOAD_POWER_PROFILES: WorkloadPowerProfile[] = [
  { workloadType: "inference",    avgWattsPerUnit: 300,  computeUnit: "gpu-hour",   pueMultiplier: 1.2 },
  { workloadType: "training",     avgWattsPerUnit: 400,  computeUnit: "gpu-hour",   pueMultiplier: 1.2 },
  { workloadType: "fine-tuning",  avgWattsPerUnit: 350,  computeUnit: "gpu-hour",   pueMultiplier: 1.2 },
  { workloadType: "embedding",    avgWattsPerUnit: 150,  computeUnit: "gpu-hour",   pueMultiplier: 1.2 },
  { workloadType: "storage",      avgWattsPerUnit: 10,   computeUnit: "tb-hour",    pueMultiplier: 1.15 },
  { workloadType: "networking",   avgWattsPerUnit: 50,   computeUnit: "gb-transferred", pueMultiplier: 1.1 },
];

export function lookupRegionIntensity(
  provider: string,
  regionCode: string,
): RegionCarbonIntensity | undefined {
  return REGION_CARBON_CATALOG.find(
    (r) => r.provider === provider && r.regionCode === regionCode,
  ) ?? REGION_CARBON_CATALOG.find(
    (r) => r.provider === provider && r.regionCode === "global",
  );
}

export function lookupWorkloadProfile(
  workloadType: string,
  computeUnit: string,
): WorkloadPowerProfile | undefined {
  return WORKLOAD_POWER_PROFILES.find(
    (p) => p.workloadType === workloadType && p.computeUnit === computeUnit,
  ) ?? WORKLOAD_POWER_PROFILES.find(
    (p) => p.workloadType === workloadType,
  );
}
