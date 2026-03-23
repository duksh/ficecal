// ─── NormalizedCostRecord — data validation pipeline (Gap D5) ─────────────────
//
// Provides runtime validation functions with structured error reporting
// (returns { valid, errors } rather than throwing).
//
// The existing validateNormalizedCostRecord() in index.ts is an assertion
// guard that throws on the first invalid field. This module provides a
// batch-friendly, non-throwing alternative with full error collection.

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of validating a single NormalizedCostRecord. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Per-record failure entry for batch validation. */
export interface InvalidRecordEntry {
  index: number;
  errors: string[];
}

/** Result of validating a batch of NormalizedCostRecord candidates. */
export interface BatchValidationResult {
  valid: boolean;
  totalRecords: number;
  validCount: number;
  invalidRecords: InvalidRecordEntry[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_FRESHNESS_STATUSES = new Set(["fresh", "stale", "very-stale", "unknown"]);
const VALID_DATA_SOURCES = new Set(["live", "deterministic", "cached", "fixture"]);
const ISO_4217_PATTERN = /^[A-Z]{3}$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: string): boolean {
  // Accept YYYY-MM-DD, YYYY-MM-DDThh:mm:ssZ, and similar ISO 8601 forms
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// ─── Single-record validator ──────────────────────────────────────────────────

/**
 * Validate that `record` conforms to the NormalizedCostRecord shape.
 *
 * Checks:
 * 1. record is a plain object (not null, not array)
 * 2. Required fields: id (maps to recordId), schemaVersion, providerId (maps to
 *    provider), serviceName, billedCost (parseable float), billingCurrency (ISO 4217)
 * 3. Optional field types when present:
 *    - dataFreshnessStatus: "fresh" | "stale" | "very-stale" | "unknown"
 *    - dataSource: "live" | "deterministic" | "cached" | "fixture"
 *    - servicePeriodStart / servicePeriodEnd: valid ISO date strings
 *
 * Note: the NormalizedCostRecord type uses `recordId` and `provider` rather than
 * `id` and `providerId`. This validator accepts both naming conventions to support
 * records produced by integration adapters before they are fully mapped.
 *
 * @returns { valid: boolean; errors: string[] }
 */
export function validateNormalizedCostRecord(record: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Must be a plain object
  if (!isPlainObject(record)) {
    return {
      valid: false,
      errors: ["record must be a non-null, non-array object"],
    };
  }

  const r = record as Record<string, unknown>;

  // 2. Required fields — accept both recordId/id and provider/providerId
  const id = r["recordId"] ?? r["id"];
  if (typeof id !== "string" || id.trim() === "") {
    errors.push('required field "recordId" (or "id") must be a non-empty string');
  }

  if (typeof r["schemaVersion"] !== "string" || (r["schemaVersion"] as string).trim() === "") {
    errors.push('required field "schemaVersion" must be a non-empty string');
  }

  const providerId = r["provider"] ?? r["providerId"];
  if (typeof providerId !== "string" || (providerId as string).trim() === "") {
    errors.push('required field "provider" (or "providerId") must be a non-empty string');
  }

  if (typeof r["serviceName"] !== "string" || (r["serviceName"] as string).trim() === "") {
    errors.push('required field "serviceName" must be a non-empty string');
  }

  // billedCost: must be a string parseable as float
  const billedCost = r["billedCost"];
  if (billedCost !== undefined) {
    if (typeof billedCost !== "string") {
      errors.push('"billedCost" must be a string when present');
    } else if (isNaN(parseFloat(billedCost as string))) {
      errors.push('"billedCost" must be parseable as a floating-point number');
    }
  } else {
    // billedCost not present — check the `amount` fallback
    const amount = r["amount"];
    if (amount !== undefined) {
      if (typeof amount !== "string") {
        errors.push('"amount" must be a string when present');
      } else if (isNaN(parseFloat(amount as string))) {
        errors.push('"amount" must be parseable as a floating-point number');
      }
    } else {
      errors.push('required cost field: either "billedCost" or "amount" must be present as a string');
    }
  }

  // billingCurrency: 3-letter ISO 4217
  const billingCurrency = r["billingCurrency"] ?? r["currency"];
  if (billingCurrency !== undefined) {
    if (typeof billingCurrency !== "string" || !ISO_4217_PATTERN.test(billingCurrency as string)) {
      errors.push('"billingCurrency" (or "currency") must be a 3-letter ISO 4217 code (e.g. "USD")');
    }
  } else {
    errors.push('required field "billingCurrency" (or "currency") must be present');
  }

  // 3. Optional fields — type-check when present
  const freshnessStatus = r["dataFreshnessStatus"];
  if (freshnessStatus !== undefined) {
    if (!VALID_FRESHNESS_STATUSES.has(freshnessStatus as string)) {
      errors.push(
        `"dataFreshnessStatus" must be one of: ${[...VALID_FRESHNESS_STATUSES].join(", ")} — got "${freshnessStatus}"`,
      );
    }
  }

  const dataSource = r["dataSource"];
  if (dataSource !== undefined) {
    if (!VALID_DATA_SOURCES.has(dataSource as string)) {
      errors.push(
        `"dataSource" must be one of: ${[...VALID_DATA_SOURCES].join(", ")} — got "${dataSource}"`,
      );
    }
  }

  const servicePeriodStart = r["servicePeriodStart"];
  if (servicePeriodStart !== undefined) {
    if (typeof servicePeriodStart !== "string" || !isValidIsoDate(servicePeriodStart as string)) {
      errors.push('"servicePeriodStart" must be a valid ISO date string when present');
    }
  }

  const servicePeriodEnd = r["servicePeriodEnd"];
  if (servicePeriodEnd !== undefined) {
    if (typeof servicePeriodEnd !== "string" || !isValidIsoDate(servicePeriodEnd as string)) {
      errors.push('"servicePeriodEnd" must be a valid ISO date string when present');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Batch validator ──────────────────────────────────────────────────────────

/**
 * Validate a batch of candidate NormalizedCostRecord objects.
 *
 * @returns {
 *   valid         — true if all records passed validation
 *   totalRecords  — total number of records evaluated
 *   validCount    — number of records that passed validation
 *   invalidRecords — array of { index, errors } for failed records
 * }
 */
export function validateNormalizedCostBatch(records: unknown[]): BatchValidationResult {
  const invalidRecords: InvalidRecordEntry[] = [];

  for (let i = 0; i < records.length; i++) {
    const result = validateNormalizedCostRecord(records[i]);
    if (!result.valid) {
      invalidRecords.push({ index: i, errors: result.errors });
    }
  }

  const validCount = records.length - invalidRecords.length;
  return {
    valid: invalidRecords.length === 0,
    totalRecords: records.length,
    validCount,
    invalidRecords,
  };
}
