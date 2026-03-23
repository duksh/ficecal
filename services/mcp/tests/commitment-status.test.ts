// ─── billing.commitment.status MCP Tool Tests ──────────────────────────────────
//
// Phase 8 integration tests for billing.commitment.status.
// Uses app.inject() — no live port, no external dependencies, deterministic fixtures.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";
import { _resetRegistry } from "../src/transport/registry.js";

let app: FastifyInstance;

beforeEach(async () => {
  _resetRegistry();
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  _resetRegistry();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callCommitmentStatus(
  provider: string,
  extra: Record<string, unknown> = {}
) {
  return app.inject({
    method: "POST",
    url: "/mcp/v1/tools/billing.commitment.status/call",
    payload: {
      input: {
        provider,
        periodStart: "2026-01-01",
        periodEnd: "2026-02-01",
        ...extra,
      },
    },
  });
}

// ─── Tool registration ────────────────────────────────────────────────────────

describe("billing.commitment.status — registration", () => {
  it("tool is registered and appears in health toolCount", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.json().toolCount).toBe(23);
  });

  it("tool appears in capabilities manifest under billing namespace", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const billingNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "billing"
    );
    expect(billingNs).toBeDefined();
  });
});

// ─── AWS — all commitments ────────────────────────────────────────────────────

describe("billing.commitment.status — AWS fixture", () => {
  it("returns 200", async () => {
    const res = await callCommitmentStatus("aws");
    expect(res.statusCode).toBe(200);
  });

  it("returns correct toolId", async () => {
    const res = await callCommitmentStatus("aws");
    expect(res.json().toolId).toBe("billing.commitment.status");
  });

  it("returns 3 commitments for AWS fixture", async () => {
    const res = await callCommitmentStatus("aws");
    const { commitments } = res.json().output;
    expect(commitments).toHaveLength(3);
  });

  it("returns ingestMode: deterministic", async () => {
    const res = await callCommitmentStatus("aws");
    expect(res.json().output.ingestMode).toBe("deterministic");
  });

  it("returns fixtureVersion 1.0.0", async () => {
    const res = await callCommitmentStatus("aws");
    expect(res.json().output.fixtureVersion).toBe("1.0.0");
  });

  it("includes deterministic warning", async () => {
    const res = await callCommitmentStatus("aws");
    const { warnings } = res.json();
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.some((w: string) => w.includes("deterministic"))).toBe(true);
  });

  it("commitments have all 7 FOCUS CommitmentDiscount fields", async () => {
    const res = await callCommitmentStatus("aws");
    const commitment = res.json().output.commitments[0];
    expect(commitment.commitmentDiscountId).toBeDefined();
    expect(commitment.commitmentDiscountCategory).toBeDefined();
    expect(commitment.commitmentDiscountType).toBeDefined();
    expect(commitment.commitmentDiscountStatus).toBeDefined();
    expect(commitment.commitmentDiscountQuantity).toBeDefined();
    expect(commitment.commitmentDiscountUnit).toBeDefined();
    // commitmentDiscountName is optional (not in required 7) but present in fixture
    expect(commitment.commitmentDiscountName).toBeDefined();
  });

  it("commitments have periodStart and periodEnd echoed back", async () => {
    const res = await callCommitmentStatus("aws");
    const commitment = res.json().output.commitments[0];
    expect(commitment.periodStart).toBe("2026-01-01");
    expect(commitment.periodEnd).toBe("2026-02-01");
  });

  it("summary has correct totalCount of 3", async () => {
    const res = await callCommitmentStatus("aws");
    const { summary } = res.json().output;
    expect(summary.totalCount).toBe(3);
  });

  it("summary has 2 used and 1 unused for AWS fixture", async () => {
    const res = await callCommitmentStatus("aws");
    const { summary } = res.json().output;
    expect(summary.usedCount).toBe(2);
    expect(summary.unusedCount).toBe(1);
  });

  it("summary utilisationRate is 2/3 ≈ 0.6667", async () => {
    const res = await callCommitmentStatus("aws");
    const { utilisationRate } = res.json().output.summary;
    expect(utilisationRate).toBeCloseTo(0.6667, 3);
  });

  it("summary totalNetSavings is positive", async () => {
    const res = await callCommitmentStatus("aws");
    const { totalNetSavings } = res.json().output.summary;
    expect(totalNetSavings).toBeGreaterThan(0);
  });

  it("summary totalWastedSpend is > 0 (one unused commitment)", async () => {
    const res = await callCommitmentStatus("aws");
    const { totalWastedSpend } = res.json().output.summary;
    expect(totalWastedSpend).toBeGreaterThan(0);
  });

  it("AWS fixture has Savings Plans and Reserved Instance types", async () => {
    const res = await callCommitmentStatus("aws");
    const { commitments } = res.json().output;
    const types = commitments.map((c: { commitmentDiscountType: string }) => c.commitmentDiscountType);
    expect(types).toContain("Savings Plans");
    expect(types).toContain("Reserved Instance");
  });

  it("echoes requestId from x-request-id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/billing.commitment.status/call",
      headers: { "x-request-id": "commitment-test-001" },
      payload: {
        input: { provider: "aws", periodStart: "2026-01-01", periodEnd: "2026-02-01" },
      },
    });
    expect(res.json().requestId).toBe("commitment-test-001");
  });
});

// ─── GCP fixture ──────────────────────────────────────────────────────────────

describe("billing.commitment.status — GCP fixture", () => {
  it("returns 200 for gcp provider", async () => {
    const res = await callCommitmentStatus("gcp");
    expect(res.statusCode).toBe(200);
  });

  it("returns 2 commitments for GCP fixture", async () => {
    const res = await callCommitmentStatus("gcp");
    expect(res.json().output.commitments).toHaveLength(2);
  });

  it("GCP commitments have CUD type", async () => {
    const res = await callCommitmentStatus("gcp");
    const { commitments } = res.json().output;
    expect(
      commitments.every(
        (c: { commitmentDiscountType: string }) => c.commitmentDiscountType === "Committed Use Discount"
      )
    ).toBe(true);
  });

  it("GCP summary has utilisationRate of 1.0 (all used)", async () => {
    const res = await callCommitmentStatus("gcp");
    expect(res.json().output.summary.utilisationRate).toBe(1);
  });

  it("GCP summary totalWastedSpend is 0", async () => {
    const res = await callCommitmentStatus("gcp");
    expect(res.json().output.summary.totalWastedSpend).toBe(0);
  });
});

// ─── Azure fixture ────────────────────────────────────────────────────────────

describe("billing.commitment.status — Azure fixture", () => {
  it("returns 200 for azure provider", async () => {
    const res = await callCommitmentStatus("azure");
    expect(res.statusCode).toBe(200);
  });

  it("returns 1 commitment for Azure fixture", async () => {
    const res = await callCommitmentStatus("azure");
    expect(res.json().output.commitments).toHaveLength(1);
  });
});

// ─── filterStatus ────────────────────────────────────────────────────────────

describe("billing.commitment.status — filterStatus", () => {
  it("filterStatus: used returns only used commitments", async () => {
    const res = await callCommitmentStatus("aws", { filterStatus: "used" });
    const { commitments } = res.json().output;
    expect(commitments).toHaveLength(2);
    expect(
      commitments.every(
        (c: { commitmentDiscountStatus: string }) => c.commitmentDiscountStatus === "used"
      )
    ).toBe(true);
  });

  it("filterStatus: unused returns only unused commitments", async () => {
    const res = await callCommitmentStatus("aws", { filterStatus: "unused" });
    const { commitments } = res.json().output;
    expect(commitments).toHaveLength(1);
    expect(commitments[0].commitmentDiscountStatus).toBe("unused");
  });

  it("summary reflects filtered results", async () => {
    const res = await callCommitmentStatus("aws", { filterStatus: "used" });
    const { summary } = res.json().output;
    expect(summary.totalCount).toBe(2);
    expect(summary.unusedCount).toBe(0);
    expect(summary.utilisationRate).toBe(1);
  });
});

// ─── filterType ───────────────────────────────────────────────────────────────

describe("billing.commitment.status — filterType", () => {
  it("filterType: Savings Plans returns only Savings Plans", async () => {
    const res = await callCommitmentStatus("aws", { filterType: "Savings" });
    const { commitments } = res.json().output;
    expect(commitments.length).toBeGreaterThan(0);
    expect(
      commitments.every(
        (c: { commitmentDiscountType: string }) =>
          c.commitmentDiscountType.toLowerCase().includes("savings")
      )
    ).toBe(true);
  });

  it("filterType: Reserved returns only Reserved Instances", async () => {
    const res = await callCommitmentStatus("aws", { filterType: "Reserved" });
    const { commitments } = res.json().output;
    expect(commitments).toHaveLength(1);
    expect(commitments[0].commitmentDiscountType).toContain("Reserved");
  });

  it("filterType is case-insensitive", async () => {
    const upper = await callCommitmentStatus("aws", { filterType: "SAVINGS" });
    const lower = await callCommitmentStatus("aws", { filterType: "savings" });
    expect(upper.json().output.commitments.length).toBe(
      lower.json().output.commitments.length
    );
  });

  it("filterType with no matches returns empty commitments and zero summary", async () => {
    const res = await callCommitmentStatus("aws", { filterType: "nonexistent-type-xyz" });
    const { commitments, summary } = res.json().output;
    expect(commitments).toHaveLength(0);
    expect(summary.totalCount).toBe(0);
    expect(summary.utilisationRate).toBeNull();
  });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe("billing.commitment.status — errors", () => {
  it("returns 500 for unknown provider", async () => {
    const res = await callCommitmentStatus("unknown-cloud");
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe("TOOL_EXECUTION_FAILED");
  });

  it("returns 400 when input is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/billing.commitment.status/call",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
