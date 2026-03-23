// ─── OpenOps Export Format ─────────────────────────────────────────────────────
//
// OpenOps exports cost data as a JSON array of records.
// This module normalises them into NormalizedCostRecord[] for FiceCal.
//
// Reference: https://www.openops.com

/** A single record in an OpenOps cost export JSON. */
export interface OpenOpsCostRecord {
  id?: string;
  service: string;
  resource_id?: string;
  resource_name?: string;
  account_id?: string;
  region?: string;
  usage_type?: string;
  amount: string | number;
  currency: string;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  tags?: Record<string, string>;
  provider?: string;    // "aws" | "gcp" | "azure"
}

/** Options for the OpenOps adapter. */
export interface OpenOpsAdapterOptions {
  /** Default provider if records don't include provider field. */
  defaultProvider?: string;
  /** Override dataSource label. */
  dataSource?: "live" | "deterministic" | "cached" | "fixture";
}
