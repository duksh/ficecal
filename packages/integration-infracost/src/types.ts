// ─── Infracost JSON Output Types ───────────────────────────────────────────────
//
// Infracost outputs JSON with a structured hierarchy:
//   InfracostOutput → InfracostProject[] → InfracostBreakdown → InfracostResource[]
//
// Reference: https://www.infracost.io/docs/features/json_output_format/

/** A single cost component within a resource (e.g. instance usage, storage). */
export interface InfracostCostComponent {
  /** Human-readable name, e.g. "Instance usage (Linux/UNIX, on-demand, t3.large)". */
  name: string;
  /** Unit of measure, e.g. "hours", "GB", "requests". */
  unit: string;
  /** Monthly quantity as a decimal-safe string. */
  monthlyQuantity: string;
  /** Per-unit price as a decimal-safe string. */
  price: string;
  /** Total monthly cost as a decimal-safe string. */
  monthlyCost: string;
  /** Hourly cost as a decimal-safe string (may not always be present). */
  hourlyCost?: string;
}

/** A single Terraform resource with its estimated costs. */
export interface InfracostResource {
  /** Terraform resource address, e.g. "aws_instance.web". */
  name: string;
  /** Terraform resource type, e.g. "aws_instance". */
  resourceType: string;
  /** Provider-assigned tags on the resource. */
  tags?: Record<string, string>;
  /** Total estimated monthly cost as a decimal-safe string. */
  monthlyCost: string;
  /** Estimated hourly cost as a decimal-safe string. */
  hourlyCost?: string;
  /** Breakdown of individual cost components driving the monthly cost. */
  costComponents: InfracostCostComponent[];
}

/** The cost breakdown for a single project (a Terraform root module). */
export interface InfracostBreakdown {
  resources: InfracostResource[];
}

/** Metadata associated with an Infracost project. */
export interface InfracostProjectMetadata {
  /** Filesystem path to the Terraform root module. */
  path: string;
  /** Optional Terraform workspace name. */
  terraformWorkspace?: string;
}

/** A single Infracost project (Terraform root module) with its breakdown. */
export interface InfracostProject {
  /** Project name (often the directory or VCS repo name). */
  name: string;
  metadata: InfracostProjectMetadata;
  breakdown: InfracostBreakdown;
}

/** Top-level Infracost JSON output document. */
export interface InfracostOutput {
  /** Infracost schema version, e.g. "0.2". */
  version: string;
  /** ISO 4217 currency code used for all cost estimates. */
  currency: string;
  /** All evaluated Terraform projects. */
  projects: InfracostProject[];
}

/** Options for the Infracost adapter. */
export interface InfracostAdapterOptions {
  /** Override the dataSource label. Defaults to "live". */
  dataSource?: "live" | "deterministic" | "cached" | "fixture";
}
