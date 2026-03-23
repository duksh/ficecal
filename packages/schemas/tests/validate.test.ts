// ─── NormalizedCostRecord — validate.ts tests (Gap D5) ────────────────────────
//
// Tests for the non-throwing { valid, errors } validation pipeline.

import { describe, it, expect } from "vitest";
import {
  validateNormalizedCostRecord,
  validateNormalizedCostBatch,
} from "../normalized-cost-record/validate.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A minimal valid record (adapter-produced shape using billedCost). */
const VALID_ADAPTER_RECORD = {
  recordId: "rec-001",
  schemaVersion: "2.2.0",
  provider: "aws",
  serviceName: "AmazonBedrock",
  billedCost: "12.345600",
  billingCurrency: "USD",
  dataFreshnessStatus: "fresh",
  dataSource: "live",
  servicePeriodStart: "2026-01-01",
  servicePeriodEnd: "2026-02-01",
};

/** A valid record using the `amount` + `currency` alternative fields. */
const VALID_AMOUNT_RECORD = {
  recordId: "rec-002",
  schemaVersion: "2.1.0",
  provider: "gcp",
  serviceName: "compute.googleapis.com",
  amount: "99.000000",
  currency: "EUR",
};

// ─── validateNormalizedCostRecord ─────────────────────────────────────────────

describe("validateNormalizedCostRecord", () => {
  it("returns valid=true for a well-formed adapter record", () => {
    const result = validateNormalizedCostRecord(VALID_ADAPTER_RECORD);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid=true for a record using amount/currency instead of billedCost/billingCurrency", () => {
    const result = validateNormalizedCostRecord(VALID_AMOUNT_RECORD);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns valid=false for null (not an object)", () => {
    const result = validateNormalizedCostRecord(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns valid=false for an array", () => {
    const result = validateNormalizedCostRecord([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/non-null.*non-array/);
  });

  it("returns valid=false when recordId is missing", () => {
    const { recordId: _id, ...noId } = VALID_ADAPTER_RECORD;
    const result = validateNormalizedCostRecord(noId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("recordId"))).toBe(true);
  });

  it("returns valid=false when schemaVersion is missing", () => {
    const { schemaVersion: _sv, ...noSv } = VALID_ADAPTER_RECORD;
    const result = validateNormalizedCostRecord(noSv);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("schemaVersion"))).toBe(true);
  });

  it("returns valid=false when provider is missing", () => {
    const { provider: _p, ...noP } = VALID_ADAPTER_RECORD;
    const result = validateNormalizedCostRecord(noP);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("provider"))).toBe(true);
  });

  it("returns valid=false when serviceName is missing", () => {
    const { serviceName: _sn, ...noSn } = VALID_ADAPTER_RECORD;
    const result = validateNormalizedCostRecord(noSn);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("serviceName"))).toBe(true);
  });

  it("returns valid=false when billedCost is not parseable as a number", () => {
    const result = validateNormalizedCostRecord({
      ...VALID_ADAPTER_RECORD,
      billedCost: "not-a-number",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("billedCost"))).toBe(true);
  });

  it("returns valid=false when billingCurrency is not a 3-letter code", () => {
    const result = validateNormalizedCostRecord({
      ...VALID_ADAPTER_RECORD,
      billingCurrency: "us",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("billingCurrency") || e.includes("currency"))).toBe(true);
  });

  it("returns valid=false for invalid dataFreshnessStatus", () => {
    const result = validateNormalizedCostRecord({
      ...VALID_ADAPTER_RECORD,
      dataFreshnessStatus: "kinda-old",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("dataFreshnessStatus"))).toBe(true);
  });

  it("returns valid=false for invalid dataSource", () => {
    const result = validateNormalizedCostRecord({
      ...VALID_ADAPTER_RECORD,
      dataSource: "realtime",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("dataSource"))).toBe(true);
  });

  it("returns valid=false for invalid servicePeriodStart date", () => {
    const result = validateNormalizedCostRecord({
      ...VALID_ADAPTER_RECORD,
      servicePeriodStart: "not-a-date",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("servicePeriodStart"))).toBe(true);
  });

  it("returns valid=false for invalid servicePeriodEnd date", () => {
    const result = validateNormalizedCostRecord({
      ...VALID_ADAPTER_RECORD,
      servicePeriodEnd: "32-13-2026",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("servicePeriodEnd"))).toBe(true);
  });

  it("collects multiple errors in a single pass", () => {
    const result = validateNormalizedCostRecord({
      schemaVersion: 123,        // wrong type
      provider: "",              // empty
      serviceName: undefined,    // missing
      billedCost: "bad",         // not parseable
      billingCurrency: "USDD",   // too many chars
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("accepts all valid dataFreshnessStatus values", () => {
    const statuses = ["fresh", "stale", "very-stale", "unknown"] as const;
    for (const status of statuses) {
      const result = validateNormalizedCostRecord({
        ...VALID_ADAPTER_RECORD,
        dataFreshnessStatus: status,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all valid dataSource values", () => {
    const sources = ["live", "deterministic", "cached", "fixture"] as const;
    for (const source of sources) {
      const result = validateNormalizedCostRecord({
        ...VALID_ADAPTER_RECORD,
        dataSource: source,
      });
      expect(result.valid).toBe(true);
    }
  });
});

// ─── validateNormalizedCostBatch ──────────────────────────────────────────────

describe("validateNormalizedCostBatch", () => {
  it("returns all-valid result for a batch of valid records", () => {
    const result = validateNormalizedCostBatch([VALID_ADAPTER_RECORD, VALID_AMOUNT_RECORD]);
    expect(result.valid).toBe(true);
    expect(result.totalRecords).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.invalidRecords).toHaveLength(0);
  });

  it("returns valid=true and empty invalidRecords for an empty batch", () => {
    const result = validateNormalizedCostBatch([]);
    expect(result.valid).toBe(true);
    expect(result.totalRecords).toBe(0);
    expect(result.validCount).toBe(0);
    expect(result.invalidRecords).toHaveLength(0);
  });

  it("identifies invalid records by index", () => {
    const records = [
      VALID_ADAPTER_RECORD,
      { schemaVersion: "2.2.0" }, // invalid — missing most required fields
      VALID_AMOUNT_RECORD,
      null,                        // invalid
    ];
    const result = validateNormalizedCostBatch(records);
    expect(result.valid).toBe(false);
    expect(result.totalRecords).toBe(4);
    expect(result.validCount).toBe(2);
    expect(result.invalidRecords.some((r) => r.index === 1)).toBe(true);
    expect(result.invalidRecords.some((r) => r.index === 3)).toBe(true);
  });

  it("reports errors per invalid record", () => {
    const result = validateNormalizedCostBatch([{ foo: "bar" }]);
    expect(result.invalidRecords[0].errors.length).toBeGreaterThan(0);
  });

  it("counts valid and invalid records correctly in a mixed batch", () => {
    const records = [
      VALID_ADAPTER_RECORD,
      { invalid: true },
      VALID_AMOUNT_RECORD,
      { also_invalid: true },
    ];
    const result = validateNormalizedCostBatch(records);
    expect(result.validCount).toBe(2);
    expect(result.invalidRecords).toHaveLength(2);
  });
});
