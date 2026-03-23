// ─── NormalizedCostRecord v2 Tests ────────────────────────────────────────────
//
// Validates schema version 2.1.0 — FOCUS 1.3 coverage (~72/77 columns).
// Tests cover:
//   - Schema version constant
//   - v1 required fields (backward-compatible)
//   - v2 new enum types (incl. v2.1 CapacityReservationStatus)
//   - v2 new optional fields (billing context, sub-account, resource, pricing,
//     commitment discount dataset, allocation, tags)
//   - v2.1 new optional fields (capacity reservation, SKU meters, pricing
//     currency, service period, billing currency, allocation extensions,
//     contractApplied)
//   - validateNormalizedCostRecord() — pass and fail cases
//   - isNormalizedCostRecord() type-guard
//   - deriveTagKeys() and upgradeToV2() migration helpers
//   - FOCUS gap registry export
//   - ContractCommitmentRecord type and CONTRACT_COMMITMENT_SCHEMA_VERSION

import { describe, it, expect } from "vitest";
import {
  NORMALIZED_COST_RECORD_SCHEMA_VERSION,
  CONTRACT_COMMITMENT_SCHEMA_VERSION,
  FOCUS_V1_3_GAP_COLUMNS,
  NormalizedCostRecordValidationError,
  assertNormalizedCostRecord,
  isNormalizedCostRecord,
  deriveTagKeys,
  upgradeToV2,
} from "../normalized-cost-record/index.js";
import type {
  NormalizedCostRecord,
  ContractCommitmentRecord,
  ChargeCategory,
  ChargeClass,
  ChargeFrequency,
  PricingCategory,
  CommitmentDiscountCategory,
  CommitmentDiscountStatus,
  CapacityReservationStatus,
  PublisherCategory,
  ContractStatus,
} from "../normalized-cost-record/index.js";

// Wrapper retaining the assertion signature for backward-compatible test usage.
function validateNormalizedCostRecord(
  record: Partial<NormalizedCostRecord>,
): asserts record is NormalizedCostRecord {
  assertNormalizedCostRecord(record);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid v2 record — only required fields populated. */
const MINIMAL_V2: NormalizedCostRecord = {
  recordId: "rec-001",
  sourceSystem: "aws-cur",
  provider: "aws",
  providerRole: "direct-provider",
  billingPeriodStart: "2026-01-01T00:00:00Z",
  billingPeriodEnd: "2026-02-01T00:00:00Z",
  chargePeriodStart: "2026-01-15T00:00:00Z",
  chargePeriodEnd: "2026-01-16T00:00:00Z",
  currency: "USD",
  amount: "1450.32",
  amountType: "actual",
  dataCompleteness: "complete",
  ingestedAt: "2026-02-02T10:00:00Z",
  schemaVersion: "2.3.0",
};

/** Fully populated v2 record — all FOCUS 1.3 fields included. */
const FULL_V2: NormalizedCostRecord = {
  ...MINIMAL_V2,

  // Billing account
  billingAccountId: "123456789012",
  billingAccountName: "ficecal-production",
  invoiceId: "INV-2026-01-001",
  invoiceIssuerName: "Amazon Web Services, Inc.",
  publisherName: "Amazon Web Services",
  publisherCategory: "cloud-provider",

  // Sub-account
  subAccountId: "987654321098",
  subAccountName: "ficecal-prod-workloads",

  // Charge detail
  chargeCategory: "usage",
  chargeDescription: "Amazon Bedrock - Claude 3 Sonnet - Input tokens (us-east-1)",
  chargeFrequency: "usage-based",

  // Cost columns
  billedCost: "1450.32",
  listCost: "1595.35",
  listUnitPrice: "0.00003",
  contractedCost: "1450.32",
  contractedUnitPrice: "0.0000271875",
  effectiveCost: "1087.74",
  billedUnitPrice: "0.0000271875",

  // Pricing
  pricingCategory: "standard",
  pricingQuantity: "48344000",
  pricingUnit: "tokens",
  skuId: "BEDROCK-CLAUDE3-SONNET-INPUT-TOKENS",
  skuPriceId: "BEDROCK-CLAUDE3-SONNET-INPUT-USEast1-2026",

  // Service
  serviceCategory: "AI / Machine Learning",
  serviceName: "Amazon Bedrock",
  resourceId: "arn:aws:bedrock:us-east-1:123456789012:model/anthropic.claude-3-sonnet-20240229-v1:0",
  resourceName: "Claude 3 Sonnet",
  resourceType: "LLM Inference Endpoint",

  // Geography
  region: "us-east-1",
  regionId: "us-east-1",
  regionName: "US East (N. Virginia)",
  availabilityZone: "us-east-1a",

  // Usage
  usageQuantity: "48344000",
  usageUnit: "tokens",

  // Commitment (v1)
  commitmentType: "savings-plan",
  commitmentReference: "arn:aws:savingsplans::123456789012:savingsplan/sp-abc123",

  // Commitment discount dataset (7 FOCUS columns)
  commitmentDiscountCategory: "spend",
  commitmentDiscountId: "arn:aws:savingsplans::123456789012:savingsplan/sp-abc123",
  commitmentDiscountName: "ficecal-bedrock-sp-2026",
  commitmentDiscountStatus: "used",
  commitmentDiscountType: "Savings Plans",
  commitmentDiscountQuantity: "1087.74",
  commitmentDiscountUnit: "USD",

  // Allocation
  allocationScope: "team-ai-platform",
  allocationMethod: "proportional",
  allocationSource: "ficecal-allocation-engine-v1",
  consumerEntityId: "team-ai-platform",
  ownerEntityId: "org-ficecal",
  allocatedCost: "1450.32",

  // Tags
  tags: { Environment: "production", Team: "ai-platform", CostCenter: "CC-1042" },
  tagKeys: ["CostCenter", "Environment", "Team"],
  dimensions: { usageType: "USE1-Bedrock-InputTokens:claude-3-sonnet" },

  // Data quality
  dataRecencyTimestamp: "2026-02-01T23:59:00Z",
};

// ─── Schema version ───────────────────────────────────────────────────────────

describe("NORMALIZED_COST_RECORD_SCHEMA_VERSION", () => {
  it("is 2.3.0", () => {
    expect(NORMALIZED_COST_RECORD_SCHEMA_VERSION).toBe("2.3.0");
  });
});

// ─── FOCUS gap registry ───────────────────────────────────────────────────────

describe("FOCUS_V1_3_GAP_COLUMNS", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(FOCUS_V1_3_GAP_COLUMNS)).toBe(true);
    expect(FOCUS_V1_3_GAP_COLUMNS.length).toBeGreaterThan(0);
  });

  it("includes ServiceSubcategory as a remaining gap column", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).toContain("ServiceSubcategory");
  });

  it("includes InvoiceRecordType as a remaining gap column", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).toContain("InvoiceRecordType");
  });

  it("no longer lists BillingCurrency (now implemented in v2.1)", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("BillingCurrency");
  });

  it("no longer lists ServicePeriodStart or ServicePeriodEnd (now implemented in v2.1)", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("ServicePeriodStart");
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("ServicePeriodEnd");
  });

  it("no longer lists CapacityReservationId or CapacityReservationStatus (now implemented in v2.1)", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("CapacityReservationId");
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("CapacityReservationStatus");
  });

  it("no longer lists EffectiveExchangeRate (now implemented in v2.1)", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("EffectiveExchangeRate");
  });

  it("no longer lists PricingBlockSize (now implemented in v2.1)", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("PricingBlockSize");
  });

  it("no longer lists ContractId (now implemented in v2.3 Contract Dataset)", () => {
    expect(FOCUS_V1_3_GAP_COLUMNS).not.toContain("ContractId");
  });
});

// ─── Enum type assignability ───────────────────────────────────────────────────

describe("v2 enum types", () => {
  it("ChargeCategory accepts all 5 values", () => {
    const values: ChargeCategory[] = ["usage", "purchase", "credit", "adjustment", "tax"];
    expect(values).toHaveLength(5);
  });

  it("ChargeClass only has correction", () => {
    const v: ChargeClass = "correction";
    expect(v).toBe("correction");
  });

  it("ChargeFrequency accepts all 3 values", () => {
    const values: ChargeFrequency[] = ["one-time", "recurring", "usage-based"];
    expect(values).toHaveLength(3);
  });

  it("PricingCategory accepts all 4 values", () => {
    const values: PricingCategory[] = ["standard", "dynamic", "committed", "other"];
    expect(values).toHaveLength(4);
  });

  it("CommitmentDiscountCategory accepts spend and usage", () => {
    const values: CommitmentDiscountCategory[] = ["spend", "usage"];
    expect(values).toHaveLength(2);
  });

  it("CommitmentDiscountStatus accepts used and unused", () => {
    const values: CommitmentDiscountStatus[] = ["used", "unused"];
    expect(values).toHaveLength(2);
  });

  it("PublisherCategory accepts 4 values", () => {
    const values: PublisherCategory[] = ["cloud-provider", "isv", "marketplace", "unknown"];
    expect(values).toHaveLength(4);
  });
});

// ─── validateNormalizedCostRecord — passing ───────────────────────────────────

describe("validateNormalizedCostRecord — valid records", () => {
  it("passes for minimal v2 record", () => {
    expect(() => validateNormalizedCostRecord(MINIMAL_V2)).not.toThrow();
  });

  it("passes for fully-populated v2 record", () => {
    expect(() => validateNormalizedCostRecord(FULL_V2)).not.toThrow();
  });

  it("passes when all optional v2 fields are absent", () => {
    const stripped: NormalizedCostRecord = { ...MINIMAL_V2 };
    expect(() => validateNormalizedCostRecord(stripped)).not.toThrow();
  });
});

// ─── validateNormalizedCostRecord — failures ──────────────────────────────────

describe("validateNormalizedCostRecord — missing required fields", () => {
  const REQUIRED_FIELDS = [
    "recordId",
    "sourceSystem",
    "provider",
    "providerRole",
    "billingPeriodStart",
    "billingPeriodEnd",
    "chargePeriodStart",
    "chargePeriodEnd",
    "currency",
    "amount",
    "amountType",
    "dataCompleteness",
    "ingestedAt",
    "schemaVersion",
  ] as const;

  for (const field of REQUIRED_FIELDS) {
    it(`throws when '${field}' is missing`, () => {
      const partial = { ...MINIMAL_V2 } as Partial<NormalizedCostRecord>;
      delete partial[field];
      expect(() => validateNormalizedCostRecord(partial)).toThrow(
        NormalizedCostRecordValidationError
      );
    });

    it(`thrown error for missing '${field}' includes field name`, () => {
      const partial = { ...MINIMAL_V2 } as Partial<NormalizedCostRecord>;
      delete partial[field];
      try {
        validateNormalizedCostRecord(partial);
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NormalizedCostRecordValidationError);
        expect((err as NormalizedCostRecordValidationError).field).toBe(field);
      }
    });
  }

  it("throws for empty-string recordId", () => {
    const partial = { ...MINIMAL_V2, recordId: "" } as Partial<NormalizedCostRecord>;
    expect(() => validateNormalizedCostRecord(partial)).toThrow(
      NormalizedCostRecordValidationError
    );
  });

  it("error carries recordId when recordId is present", () => {
    const partial = { ...MINIMAL_V2 } as Partial<NormalizedCostRecord>;
    delete partial.amount;
    try {
      validateNormalizedCostRecord(partial);
    } catch (err) {
      expect((err as NormalizedCostRecordValidationError).recordId).toBe("rec-001");
    }
  });
});

// ─── isNormalizedCostRecord — type-guard ──────────────────────────────────────

describe("isNormalizedCostRecord", () => {
  it("returns true for minimal v2 record", () => {
    expect(isNormalizedCostRecord(MINIMAL_V2)).toBe(true);
  });

  it("returns true for fully-populated v2 record", () => {
    expect(isNormalizedCostRecord(FULL_V2)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isNormalizedCostRecord(null)).toBe(false);
  });

  it("returns false for string", () => {
    expect(isNormalizedCostRecord("record")).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isNormalizedCostRecord({})).toBe(false);
  });

  it("returns false when required field is missing", () => {
    const bad = { ...MINIMAL_V2 } as Partial<NormalizedCostRecord>;
    delete bad.currency;
    expect(isNormalizedCostRecord(bad)).toBe(false);
  });
});

// ─── v2 optional fields round-trip ────────────────────────────────────────────

describe("v2 optional field round-trip", () => {
  it("billingAccountId and billingAccountName are present in FULL_V2", () => {
    expect(FULL_V2.billingAccountId).toBe("123456789012");
    expect(FULL_V2.billingAccountName).toBe("ficecal-production");
  });

  it("invoiceId and invoiceIssuerName are present", () => {
    expect(FULL_V2.invoiceId).toBe("INV-2026-01-001");
    expect(FULL_V2.invoiceIssuerName).toBe("Amazon Web Services, Inc.");
  });

  it("publisherName and publisherCategory are present", () => {
    expect(FULL_V2.publisherName).toBe("Amazon Web Services");
    expect(FULL_V2.publisherCategory).toBe("cloud-provider");
  });

  it("subAccountId and subAccountName are present", () => {
    expect(FULL_V2.subAccountId).toBe("987654321098");
    expect(FULL_V2.subAccountName).toBe("ficecal-prod-workloads");
  });

  it("chargeCategory, chargeFrequency, chargeDescription are present", () => {
    expect(FULL_V2.chargeCategory).toBe("usage");
    expect(FULL_V2.chargeFrequency).toBe("usage-based");
    expect(typeof FULL_V2.chargeDescription).toBe("string");
  });

  it("all FOCUS cost columns are present", () => {
    expect(FULL_V2.billedCost).toBe("1450.32");
    expect(FULL_V2.listCost).toBe("1595.35");
    expect(FULL_V2.listUnitPrice).toBe("0.00003");
    expect(FULL_V2.contractedCost).toBe("1450.32");
    expect(FULL_V2.contractedUnitPrice).toBe("0.0000271875");
    expect(FULL_V2.effectiveCost).toBe("1087.74");
    expect(FULL_V2.billedUnitPrice).toBe("0.0000271875");
  });

  it("pricingCategory, pricingQuantity, pricingUnit are present", () => {
    expect(FULL_V2.pricingCategory).toBe("standard");
    expect(FULL_V2.pricingQuantity).toBe("48344000");
    expect(FULL_V2.pricingUnit).toBe("tokens");
  });

  it("skuId and skuPriceId are present", () => {
    expect(FULL_V2.skuId).toBe("BEDROCK-CLAUDE3-SONNET-INPUT-TOKENS");
    expect(typeof FULL_V2.skuPriceId).toBe("string");
  });

  it("resourceType is present", () => {
    expect(FULL_V2.resourceType).toBe("LLM Inference Endpoint");
  });

  it("regionId, regionName, availabilityZone are present", () => {
    expect(FULL_V2.regionId).toBe("us-east-1");
    expect(FULL_V2.regionName).toBe("US East (N. Virginia)");
    expect(FULL_V2.availabilityZone).toBe("us-east-1a");
  });

  it("all 7 FOCUS commitment discount columns are present", () => {
    expect(FULL_V2.commitmentDiscountCategory).toBe("spend");
    expect(typeof FULL_V2.commitmentDiscountId).toBe("string");
    expect(FULL_V2.commitmentDiscountName).toBe("ficecal-bedrock-sp-2026");
    expect(FULL_V2.commitmentDiscountStatus).toBe("used");
    expect(FULL_V2.commitmentDiscountType).toBe("Savings Plans");
    expect(FULL_V2.commitmentDiscountQuantity).toBe("1087.74");
    expect(FULL_V2.commitmentDiscountUnit).toBe("USD");
  });

  it("allocatedCost is present", () => {
    expect(FULL_V2.allocatedCost).toBe("1450.32");
  });

  it("tagKeys is present and sorted", () => {
    expect(FULL_V2.tagKeys).toEqual(["CostCenter", "Environment", "Team"]);
  });
});

// ─── deriveTagKeys ─────────────────────────────────────────────────────────────

describe("deriveTagKeys", () => {
  it("returns sorted tag keys from a tags object", () => {
    const tags = { Zebra: "1", Apple: "2", Mango: "3" };
    expect(deriveTagKeys(tags)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("returns undefined for undefined input", () => {
    expect(deriveTagKeys(undefined)).toBeUndefined();
  });

  it("returns undefined for empty tags object", () => {
    expect(deriveTagKeys({})).toBeUndefined();
  });

  it("returns single-element array for single tag", () => {
    expect(deriveTagKeys({ Env: "prod" })).toEqual(["Env"]);
  });
});

// ─── upgradeToV2 ──────────────────────────────────────────────────────────────

describe("upgradeToV2", () => {
  it("sets schemaVersion to the current NORMALIZED_COST_RECORD_SCHEMA_VERSION", () => {
    const v1Record: NormalizedCostRecord = { ...MINIMAL_V2, schemaVersion: "1.0.0" };
    const upgraded = upgradeToV2(v1Record);
    expect(upgraded.schemaVersion).toBe(NORMALIZED_COST_RECORD_SCHEMA_VERSION);
  });

  it("does not mutate the original record", () => {
    const v1Record: NormalizedCostRecord = { ...MINIMAL_V2, schemaVersion: "1.0.0" };
    upgradeToV2(v1Record);
    expect(v1Record.schemaVersion).toBe("1.0.0");
  });

  it("derives tagKeys from tags", () => {
    const v1Record: NormalizedCostRecord = {
      ...MINIMAL_V2,
      tags: { Team: "platform", Env: "prod" },
    };
    const upgraded = upgradeToV2(v1Record);
    expect(upgraded.tagKeys).toEqual(["Env", "Team"]);
  });

  it("sets tagKeys to undefined when no tags are present", () => {
    const upgraded = upgradeToV2({ ...MINIMAL_V2 });
    expect(upgraded.tagKeys).toBeUndefined();
  });

  it("preserves all v1 required fields unchanged", () => {
    const v1Record: NormalizedCostRecord = { ...MINIMAL_V2, schemaVersion: "1.0.0" };
    const upgraded = upgradeToV2(v1Record);
    expect(upgraded.recordId).toBe(MINIMAL_V2.recordId);
    expect(upgraded.provider).toBe(MINIMAL_V2.provider);
    expect(upgraded.amount).toBe(MINIMAL_V2.amount);
    expect(upgraded.currency).toBe(MINIMAL_V2.currency);
    expect(upgraded.ingestedAt).toBe(MINIMAL_V2.ingestedAt);
  });

  it("result passes isNormalizedCostRecord type-guard", () => {
    const v1Record: NormalizedCostRecord = { ...MINIMAL_V2, schemaVersion: "1.0.0" };
    const upgraded = upgradeToV2(v1Record);
    expect(isNormalizedCostRecord(upgraded)).toBe(true);
  });
});

// ─── v2.1 new optional fields ─────────────────────────────────────────────────

describe("v2.1 new optional fields — type acceptance", () => {
  it("accepts capacityReservationId and capacityReservationStatus", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      capacityReservationId: "cr-0a1b2c3d4e5f",
      capacityReservationStatus: "allocated",
    };
    expect(rec.capacityReservationId).toBe("cr-0a1b2c3d4e5f");
    expect(rec.capacityReservationStatus).toBe("allocated");
  });

  it("CapacityReservationStatus accepts all 3 values", () => {
    const values: CapacityReservationStatus[] = ["allocated", "unused", "expired"];
    expect(values).toHaveLength(3);
  });

  it("accepts skuMeter and skuPriceDetails", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      skuMeter: "AmazonBedrock-InputTokens:claude-3-sonnet",
      skuPriceDetails: "On-Demand, Standard",
    };
    expect(rec.skuMeter).toBe("AmazonBedrock-InputTokens:claude-3-sonnet");
    expect(rec.skuPriceDetails).toBe("On-Demand, Standard");
  });

  it("accepts pricingBlockSize as number", () => {
    const rec: NormalizedCostRecord = { ...MINIMAL_V2, pricingBlockSize: 60 };
    expect(rec.pricingBlockSize).toBe(60);
  });

  it("accepts pricingCurrencyContractedUnitPrice and pricingCurrencyEffectiveCost", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      pricingCurrencyContractedUnitPrice: "0.0000271875",
      pricingCurrencyEffectiveCost: "1087.74",
    };
    expect(rec.pricingCurrencyContractedUnitPrice).toBe("0.0000271875");
    expect(rec.pricingCurrencyEffectiveCost).toBe("1087.74");
  });

  it("accepts servicePeriodStart and servicePeriodEnd", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      servicePeriodStart: "2026-01-01T00:00:00Z",
      servicePeriodEnd: "2027-01-01T00:00:00Z",
    };
    expect(rec.servicePeriodStart).toBe("2026-01-01T00:00:00Z");
    expect(rec.servicePeriodEnd).toBe("2027-01-01T00:00:00Z");
  });

  it("accepts billingCurrency and effectiveExchangeRate", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      billingCurrency: "EUR",
      effectiveExchangeRate: "1.0849200000",
    };
    expect(rec.billingCurrency).toBe("EUR");
    expect(rec.effectiveExchangeRate).toBe("1.0849200000");
  });

  it("accepts contractApplied as boolean", () => {
    const recTrue: NormalizedCostRecord = { ...MINIMAL_V2, contractApplied: true };
    const recFalse: NormalizedCostRecord = { ...MINIMAL_V2, contractApplied: false };
    expect(recTrue.contractApplied).toBe(true);
    expect(recFalse.contractApplied).toBe(false);
  });

  it("accepts allocatedResourceId, allocatedResourceName, and allocatedTags", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      allocatedResourceId: "arn:aws:ec2:us-east-1:123456789012:instance/i-abc123",
      allocatedResourceName: "shared-gpu-cluster",
      allocatedTags: { Team: "platform", Environment: "production" },
    };
    expect(rec.allocatedResourceId).toBe("arn:aws:ec2:us-east-1:123456789012:instance/i-abc123");
    expect(rec.allocatedResourceName).toBe("shared-gpu-cluster");
    expect(rec.allocatedTags).toEqual({ Team: "platform", Environment: "production" });
  });

  it("all v2.1 fields are optional — minimal record still validates", () => {
    expect(() => validateNormalizedCostRecord(MINIMAL_V2)).not.toThrow();
  });
});

// ─── ContractCommitmentRecord ─────────────────────────────────────────────────

describe("CONTRACT_COMMITMENT_SCHEMA_VERSION", () => {
  it("is 1.0.0", () => {
    expect(CONTRACT_COMMITMENT_SCHEMA_VERSION).toBe("1.0.0");
  });
});

describe("ContractCommitmentRecord — type shape", () => {
  const MINIMAL_CONTRACT: ContractCommitmentRecord = {
    recordId: "ccr-001",
    schemaVersion: "1.0.0",
    contractId: "arn:aws:savingsplans::123456789012:savingsplan/sp-abc123",
    contractApplied: true,
    contractCommitmentCategory: "spend",
    contractCommitmentDiscount: "500.00",
    contractCommitmentDiscountUnit: "USD",
    contractCommitmentDiscountQuantity: "500.00",
    contractCommitmentStatus: "used",
    contractCommitmentType: "savings-plan",
    contractPeriodStart: "2026-01-01T00:00:00Z",
    contractPeriodEnd: "2027-01-01T00:00:00Z",
    provider: "aws",
    billingPeriodStart: "2026-01-01T00:00:00Z",
    billingPeriodEnd: "2026-02-01T00:00:00Z",
    currency: "USD",
    commitmentTotalCost: "6000.00",
    commitmentAmortizedCost: "500.00",
    commitmentWastedCost: "0.00",
    utilizationRate: "1.0000000000",
    ingestedAt: "2026-02-02T10:00:00Z",
    dataCompleteness: "complete",
  };

  it("accepts a minimal ContractCommitmentRecord", () => {
    expect(MINIMAL_CONTRACT.recordId).toBe("ccr-001");
    expect(MINIMAL_CONTRACT.contractId).toBeDefined();
    expect(MINIMAL_CONTRACT.contractApplied).toBe(true);
  });

  it("has all required financial summary fields", () => {
    expect(MINIMAL_CONTRACT.commitmentTotalCost).toBe("6000.00");
    expect(MINIMAL_CONTRACT.commitmentAmortizedCost).toBe("500.00");
    expect(MINIMAL_CONTRACT.commitmentWastedCost).toBe("0.00");
    expect(MINIMAL_CONTRACT.utilizationRate).toBe("1.0000000000");
  });

  it("has all required temporal fields", () => {
    expect(MINIMAL_CONTRACT.contractPeriodStart).toBe("2026-01-01T00:00:00Z");
    expect(MINIMAL_CONTRACT.contractPeriodEnd).toBe("2027-01-01T00:00:00Z");
    expect(MINIMAL_CONTRACT.billingPeriodStart).toBeDefined();
    expect(MINIMAL_CONTRACT.billingPeriodEnd).toBeDefined();
  });

  it("billingAccountId is optional", () => {
    const withAccount: ContractCommitmentRecord = {
      ...MINIMAL_CONTRACT,
      billingAccountId: "123456789012",
    };
    expect(withAccount.billingAccountId).toBe("123456789012");
    // Without billingAccountId also type-valid
    expect(MINIMAL_CONTRACT.billingAccountId).toBeUndefined();
  });

  it("dataCompleteness is required", () => {
    expect(MINIMAL_CONTRACT.dataCompleteness).toBe("complete");
  });

  it("ingestedAt is required", () => {
    expect(MINIMAL_CONTRACT.ingestedAt).toBe("2026-02-02T10:00:00Z");
  });
});

// ─── NormalizedCostRecordValidationError ──────────────────────────────────────

describe("NormalizedCostRecordValidationError", () => {
  it("is an instance of Error", () => {
    const err = new NormalizedCostRecordValidationError("bad record");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name 'NormalizedCostRecordValidationError'", () => {
    const err = new NormalizedCostRecordValidationError("bad record");
    expect(err.name).toBe("NormalizedCostRecordValidationError");
  });

  it("stores field and recordId from options", () => {
    const err = new NormalizedCostRecordValidationError("bad", {
      field: "currency",
      recordId: "rec-999",
    });
    expect(err.field).toBe("currency");
    expect(err.recordId).toBe("rec-999");
  });

  it("field and recordId are undefined when not provided", () => {
    const err = new NormalizedCostRecordValidationError("bad");
    expect(err.field).toBeUndefined();
    expect(err.recordId).toBeUndefined();
  });
});

// ─── NormalizedCostRecord — FOCUS 1.3 Contract Dataset fields ────────────────

describe("NormalizedCostRecord — FOCUS 1.3 Contract Dataset fields", () => {
  it("accepts a full contract dataset record", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      contractId: "EA-2026-001",
      contractName: "Enterprise Agreement 2026",
      contractType: "EnterpriseAgreement",
      contractStartDate: "2026-01-01",
      contractEndDate: "2026-12-31",
      contractDiscountRate: 0.15,
      contractCommitmentAmount: 500000,
      contractCommitmentCurrency: "USD",
      contractConsumedPercentage: 0.42,
      contractStatus: "Active",
      isContractCovered: true,
      contractTags: { "department": "engineering" },
      contractReference: "https://contracts.example.com/EA-2026-001",
      skuId: "Compute-E2-Standard-4",
      skuDescription: "E2 standard machine with 4 vCPUs",
      skuTier: "Standard",
      skuCommitmentDiscountEligible: true,
    };
    expect(rec.contractId).toBe("EA-2026-001");
    expect(rec.contractStatus).toBe("Active");
    expect(rec.skuCommitmentDiscountEligible).toBe(true);
    expect(rec.contractConsumedPercentage).toBe(0.42);
  });

  it("contractStatus accepts all valid values", () => {
    const statuses: Array<ContractStatus> = [
      "Active", "Expired", "Pending", "Terminated",
    ];
    statuses.forEach(s => {
      const rec = { contractStatus: s } as Partial<NormalizedCostRecord>;
      expect(rec.contractStatus).toBe(s);
    });
  });

  it("contract fields are all optional", () => {
    // A record with none of the contract fields should still be valid
    const rec: NormalizedCostRecord = { ...MINIMAL_V2 };
    expect(rec.contractId).toBeUndefined();
    expect(rec.contractName).toBeUndefined();
    expect(rec.contractType).toBeUndefined();
    expect(rec.contractStartDate).toBeUndefined();
    expect(rec.contractEndDate).toBeUndefined();
    expect(rec.contractDiscountRate).toBeUndefined();
    expect(rec.contractCommitmentAmount).toBeUndefined();
    expect(rec.contractCommitmentCurrency).toBeUndefined();
    expect(rec.contractConsumedPercentage).toBeUndefined();
    expect(rec.contractStatus).toBeUndefined();
    expect(rec.isContractCovered).toBeUndefined();
    expect(rec.contractTags).toBeUndefined();
    expect(rec.contractReference).toBeUndefined();
    expect(rec.skuId).toBeUndefined();
    expect(rec.skuDescription).toBeUndefined();
    expect(rec.skuTier).toBeUndefined();
    expect(rec.skuCommitmentDiscountEligible).toBeUndefined();
  });

  it("contractDiscountRate and contractCommitmentAmount accept numeric values", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      contractDiscountRate: 0.25,
      contractCommitmentAmount: 1_000_000,
      contractConsumedPercentage: 0.87,
    };
    expect(rec.contractDiscountRate).toBe(0.25);
    expect(rec.contractCommitmentAmount).toBe(1_000_000);
    expect(rec.contractConsumedPercentage).toBe(0.87);
  });

  it("contractTags accepts a key-value map", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      contractTags: { department: "engineering", costCenter: "CC-1042" },
    };
    expect(rec.contractTags).toEqual({ department: "engineering", costCenter: "CC-1042" });
  });

  it("SKU dimension fields are optional and independently assignable", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      skuDescription: "E2 standard machine with 4 vCPUs",
      skuTier: "Premium",
      skuCommitmentDiscountEligible: false,
    };
    expect(rec.skuDescription).toBe("E2 standard machine with 4 vCPUs");
    expect(rec.skuTier).toBe("Premium");
    expect(rec.skuCommitmentDiscountEligible).toBe(false);
  });

  it("minimal record still validates after adding contract fields", () => {
    const rec: NormalizedCostRecord = {
      ...MINIMAL_V2,
      contractId: "EA-2026-001",
      contractStatus: "Active",
    };
    expect(() => validateNormalizedCostRecord(rec)).not.toThrow();
  });
});
