export type {
  RegionCarbonIntensity,
  WorkloadPowerProfile,
  WorkloadType,
  CarbonEstimateInput,
  CarbonEstimateOutput,
} from "./types.js";

export {
  REGION_CARBON_CATALOG,
  WORKLOAD_POWER_PROFILES,
  lookupRegionIntensity,
  lookupWorkloadProfile,
} from "./catalog.js";

export { estimateCarbon } from "./engine.js";
