// ─── @ficecal/integration-infracost ───────────────────────────────────────────
//
// FiceCal integration adapter — Infracost JSON output → NormalizedCostRecord.

export type {
  InfracostOutput,
  InfracostProject,
  InfracostProjectMetadata,
  InfracostBreakdown,
  InfracostResource,
  InfracostCostComponent,
  InfracostAdapterOptions,
} from "./types.js";
export { normalizeInfracostResource, normalizeInfracostOutput } from "./adapter.js";
