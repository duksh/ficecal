// ─── integration-openops: adapter tests ───────────────────────────────────────

import { describe, it, expect } from "vitest";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";
import { normalizeOpenOpsRecord, normalizeOpenOpsBatch } from "../src/adapter.js";
import type { OpenOpsCostRecord } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINIMAL_RECORD: OpenOpsCostRecord = {
  service: "AmazonBedrock",
  amount: "12.345678",
  currency: "USD",
  start_date: "2026-01-01",
  end_date: "2026-02-01",
};

const FULL_RECORD: OpenOpsCostRecord = {
  id: "rec-001",
  service: "compute.googleapis.com",
  resource_id: "projects/my-proj/zones/us-central1-a/instances/vm-1",
  resource_name: "my-vm",
  account_id: "my-gcp-project",
  region: "us-central1",
  usage_type: "N1Standard_1",
  amount: 99,
  currency: "USD",
  start_date: "2026-01-01",
  end_date: "2026-02-01",
  tags: { env: "production", team: "platform" },
  provider: "gcp",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeOpenOpsRecord", () => {
  it("normalizes a minimal record (amount as string)", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.serviceName).toBe("AmazonBedrock");
    expect(result.currency).toBe("USD");
    expect(result.billingPeriodStart).toBe("2026-01-01");
    expect(result.billingPeriodEnd).toBe("2026-02-01");
  });

  it("normalizes a full record (amount as number)", () => {
    const result = normalizeOpenOpsRecord(FULL_RECORD);
    expect(result.recordId).toBe("rec-001");
    expect(result.provider).toBe("gcp");
    expect(result.serviceName).toBe("compute.googleapis.com");
    expect(result.resourceId).toBe("projects/my-proj/zones/us-central1-a/instances/vm-1");
    expect(result.resourceName).toBe("my-vm");
    expect(result.providerAccountId).toBe("my-gcp-project");
    expect(result.region).toBe("us-central1");
  });

  it("billedCost is always a string", () => {
    const fromString = normalizeOpenOpsRecord({ ...MINIMAL_RECORD, amount: "42.5" });
    const fromNumber = normalizeOpenOpsRecord({ ...MINIMAL_RECORD, amount: 42.5 });
    expect(typeof fromString.billedCost).toBe("string");
    expect(typeof fromNumber.billedCost).toBe("string");
  });

  it("billedCost is formatted to 6 decimal places", () => {
    const result = normalizeOpenOpsRecord({ ...MINIMAL_RECORD, amount: 1 });
    expect(result.billedCost).toBe("1.000000");
    expect(result.amount).toBe("1.000000");
  });

  it("dataFreshnessStatus is always 'fresh'", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.dataFreshnessStatus).toBe("fresh");
  });

  it("schemaVersion matches NORMALIZED_COST_RECORD_SCHEMA_VERSION", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.schemaVersion).toBe(NORMALIZED_COST_RECORD_SCHEMA_VERSION);
  });

  it("provider fallback: uses record.provider when present", () => {
    const result = normalizeOpenOpsRecord({ ...MINIMAL_RECORD, provider: "azure" });
    expect(result.provider).toBe("azure");
  });

  it("provider fallback: uses options.defaultProvider when record has no provider", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD, { defaultProvider: "aws" });
    expect(result.provider).toBe("aws");
  });

  it("provider fallback: defaults to 'unknown' when neither record nor options supply one", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.provider).toBe("unknown");
  });

  it("passes tags through unchanged", () => {
    const result = normalizeOpenOpsRecord(FULL_RECORD);
    expect(result.tags).toEqual({ env: "production", team: "platform" });
  });

  it("missing optional fields (no resource_id, no tags) do not produce undefined keys", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.resourceId).toBeUndefined();
    expect(result.resourceName).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it("dataSource defaults to 'live'", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.dataSource).toBe("live");
  });

  it("dataSource can be overridden via options", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD, { dataSource: "fixture" });
    expect(result.dataSource).toBe("fixture");
  });

  it("auto-generates recordId when record.id is absent", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(typeof result.recordId).toBe("string");
    expect(result.recordId.length).toBeGreaterThan(0);
  });

  it("dataRefreshedAt is a valid ISO 8601 string", () => {
    const result = normalizeOpenOpsRecord(MINIMAL_RECORD);
    expect(result.dataRefreshedAt).toBeDefined();
    expect(() => new Date(result.dataRefreshedAt!).toISOString()).not.toThrow();
  });
});

describe("normalizeOpenOpsBatch", () => {
  it("normalizes an empty array", () => {
    expect(normalizeOpenOpsBatch([])).toEqual([]);
  });

  it("normalizes multiple records and preserves order", () => {
    const records: OpenOpsCostRecord[] = [
      { ...MINIMAL_RECORD, service: "ServiceA", amount: "10" },
      { ...MINIMAL_RECORD, service: "ServiceB", amount: "20" },
      { ...MINIMAL_RECORD, service: "ServiceC", amount: "30" },
    ];
    const results = normalizeOpenOpsBatch(records);
    expect(results).toHaveLength(3);
    expect(results[0].serviceName).toBe("ServiceA");
    expect(results[1].serviceName).toBe("ServiceB");
    expect(results[2].serviceName).toBe("ServiceC");
  });

  it("applies shared options to all records in batch", () => {
    const records: OpenOpsCostRecord[] = [
      MINIMAL_RECORD,
      { ...MINIMAL_RECORD, service: "OtherService" },
    ];
    const results = normalizeOpenOpsBatch(records, { defaultProvider: "aws", dataSource: "cached" });
    for (const r of results) {
      expect(r.provider).toBe("aws");
      expect(r.dataSource).toBe("cached");
    }
  });
});
