// ─── @ficecal/integration-openops ─────────────────────────────────────────────
//
// FiceCal integration adapter — OpenOps cost export → NormalizedCostRecord.

export type { OpenOpsCostRecord, OpenOpsAdapterOptions } from "./types.js";
export { normalizeOpenOpsRecord, normalizeOpenOpsBatch } from "./adapter.js";
