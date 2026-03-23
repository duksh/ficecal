// ─── billing.chargeback.allocate MCP Tool Tests ──────────────────────────────
//
// Phase 9 integration tests for billing.chargeback.allocate.
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

async function callChargeback(
  provider: string,
  extra: Record<string, unknown> = {},
) {
  return app.inject({
    method: "POST",
    url: "/mcp/v1/tools/billing.chargeback.allocate/call",
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

describe("billing.chargeback.allocate — registration", () => {
  it("tool is registered: health toolCount is now 23", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().toolCount).toBe(23);
  });

  it("tool appears in capabilities under billing namespace", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const billingNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "billing",
    );
    expect(billingNs).toBeDefined();
  });

  it("tool descriptor has stability: beta", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const billingNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "billing",
    );
    // stability is surfaced at the namespace level in the capabilities manifest
    expect(billingNs).toBeDefined();
    expect(billingNs.stability).toBe("beta");
  });
});

// ─── AWS fixture — proportional (default) ────────────────────────────────────

describe("billing.chargeback.allocate — AWS proportional (default)", () => {
  it("returns 200 with allocations array", async () => {
    const res = await callChargeback("aws");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.output.allocations).toBeInstanceOf(Array);
    expect(body.output.allocations.length).toBeGreaterThan(0);
  });

  it("echoes provider and period", async () => {
    const res = await callChargeback("aws");
    const { output } = res.json();
    expect(output.provider).toBe("aws");
    expect(output.periodStart).toBe("2026-01-01");
    expect(output.periodEnd).toBe("2026-02-01");
  });

  it("defaults to proportional allocationMethod", async () => {
    const res = await callChargeback("aws");
    expect(res.json().output.allocationMethod).toBe("proportional");
  });

  it("AWS k8s-cluster-prod has 3 consumers with correct proportional splits", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const allocations = res.json().output.allocations;
    expect(allocations).toHaveLength(3);

    const platform = allocations.find((a: { consumerId: string }) => a.consumerId === "platform-team");
    const ml = allocations.find((a: { consumerId: string }) => a.consumerId === "ml-team");
    const data = allocations.find((a: { consumerId: string }) => a.consumerId === "data-team");

    expect(platform).toBeDefined();
    expect(ml).toBeDefined();
    expect(data).toBeDefined();

    // proportional: 0.5/0.3/0.2 of 4800 = 2400/1440/960
    expect(platform.allocatedCost).toBe(2400);
    expect(ml.allocatedCost).toBe(1440);
    expect(data.allocatedCost).toBe(960);
  });

  it("allocation fractions sum to ~1", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const allocations = res.json().output.allocations;
    const fractionSum = allocations.reduce(
      (s: number, a: { allocationFraction: number }) => s + a.allocationFraction,
      0,
    );
    expect(fractionSum).toBeCloseTo(1, 5);
  });

  it("summary totalAllocatedCost equals totalSharedCost", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const { summary } = res.json().output;
    expect(summary.totalSharedCost).toBe(4800);
    expect(summary.totalAllocatedCost).toBe(4800);
    expect(summary.consumerCount).toBe(3);
  });

  it("FOCUS AllocatedMethodID is present on each record", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const allocations = res.json().output.allocations;
    for (const a of allocations) {
      expect(a.allocatedMethodId).toBe("proportional");
      expect(typeof a.allocatedMethodDetails).toBe("string");
      expect(a.allocatedMethodDetails.length).toBeGreaterThan(0);
    }
  });

  it("FOCUS AllocatedResourceID and AllocatedResourceName are on each record", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const allocations = res.json().output.allocations;
    for (const a of allocations) {
      expect(a.allocatedResourceId).toBe("k8s-cluster-prod");
      expect(a.allocatedResourceName).toBe("Production Kubernetes Cluster (EKS)");
    }
  });

  it("FOCUS AllocatedTags are present and non-empty", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const allocations = res.json().output.allocations;
    for (const a of allocations) {
      expect(typeof a.allocatedTags).toBe("object");
      expect(Object.keys(a.allocatedTags).length).toBeGreaterThan(0);
    }
  });

  it("ingestMode is deterministic", async () => {
    const res = await callChargeback("aws");
    expect(res.json().output.ingestMode).toBe("deterministic");
  });

  it("fixtureVersion is present", async () => {
    const res = await callChargeback("aws");
    expect(res.json().output.fixtureVersion).toBe("1.0.0");
  });

  it("warnings array includes deterministic notice", async () => {
    const res = await callChargeback("aws");
    const { warnings } = res.json();
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.some((w: string) => w.includes("deterministic"))).toBe(true);
  });

  it("appliedIds reflect allocation method used", async () => {
    const res = await callChargeback("aws", { resourceId: "k8s-cluster-prod" });
    const { appliedIds } = res.json();
    expect(Array.isArray(appliedIds)).toBe(true);
    expect(appliedIds.some((id: string) => id.includes("proportional"))).toBe(true);
  });
});

// ─── AWS fixture — even split ─────────────────────────────────────────────────

describe("billing.chargeback.allocate — even split", () => {
  it("splits 4800 equally among 3 consumers → 1600 each", async () => {
    const res = await callChargeback("aws", {
      resourceId: "k8s-cluster-prod",
      allocationMethod: "even",
    });
    const allocations = res.json().output.allocations;
    for (const a of allocations) {
      expect(a.allocatedCost).toBeCloseTo(1600, 0);
      expect(a.allocatedMethodId).toBe("even");
    }
  });

  it("even split: summary totalAllocatedCost equals totalSharedCost", async () => {
    const res = await callChargeback("aws", {
      resourceId: "k8s-cluster-prod",
      allocationMethod: "even",
    });
    const { summary } = res.json().output;
    expect(summary.totalAllocatedCost).toBe(summary.totalSharedCost);
  });
});

// ─── AWS fixture — tag-based ──────────────────────────────────────────────────

describe("billing.chargeback.allocate — tag-based", () => {
  it("tag-based returns correct consumer count and method label", async () => {
    const res = await callChargeback("aws", {
      resourceId: "k8s-cluster-prod",
      allocationMethod: "tag-based",
    });
    const { output } = res.json();
    expect(output.allocationMethod).toBe("tag-based");
    expect(output.allocations).toHaveLength(3);
  });

  it("tag-based: totalAllocatedCost equals totalSharedCost", async () => {
    const res = await callChargeback("aws", {
      resourceId: "k8s-cluster-prod",
      allocationMethod: "tag-based",
    });
    const { summary } = res.json().output;
    expect(summary.totalAllocatedCost).toBe(summary.totalSharedCost);
  });
});

// ─── GCP fixture ─────────────────────────────────────────────────────────────

describe("billing.chargeback.allocate — GCP fixture", () => {
  it("GCP returns 3 consumer allocations for gke-cluster-prod", async () => {
    const res = await callChargeback("gcp", { resourceId: "gke-cluster-prod" });
    expect(res.statusCode).toBe(200);
    const allocations = res.json().output.allocations;
    expect(allocations).toHaveLength(3);
  });

  it("GCP total shared cost is 5200 USD", async () => {
    const res = await callChargeback("gcp", { resourceId: "gke-cluster-prod" });
    expect(res.json().output.summary.totalSharedCost).toBe(5200);
  });

  it("GCP proportional: engineering gets 55% of 5200", async () => {
    const res = await callChargeback("gcp", { resourceId: "gke-cluster-prod" });
    const engineering = res.json().output.allocations.find(
      (a: { consumerId: string }) => a.consumerId === "engineering",
    );
    expect(engineering.allocatedCost).toBeCloseTo(5200 * 0.55, 0);
  });
});

// ─── Azure fixture ────────────────────────────────────────────────────────────

describe("billing.chargeback.allocate — Azure fixture", () => {
  it("Azure returns 3 consumer allocations for aks-cluster-prod", async () => {
    const res = await callChargeback("azure", { resourceId: "aks-cluster-prod" });
    expect(res.statusCode).toBe(200);
    expect(res.json().output.allocations).toHaveLength(3);
  });

  it("Azure consumers have costcenter tags", async () => {
    const res = await callChargeback("azure", { resourceId: "aks-cluster-prod" });
    const allocations = res.json().output.allocations;
    for (const a of allocations) {
      expect(a.allocatedTags["costcenter"]).toBeDefined();
    }
  });
});

// ─── Multiple resources (no resourceId filter) ────────────────────────────────

describe("billing.chargeback.allocate — all resources (no filter)", () => {
  it("AWS without resourceId returns allocations for all shared resources (5 total)", async () => {
    const res = await callChargeback("aws");
    const allocations = res.json().output.allocations;
    // AWS: k8s-cluster-prod (3) + nat-gateway-us-east-1 (2) = 5
    expect(allocations).toHaveLength(5);
  });

  it("all allocation records have required FOCUS fields", async () => {
    const res = await callChargeback("aws");
    const allocations = res.json().output.allocations;
    for (const a of allocations) {
      expect(typeof a.allocatedResourceId).toBe("string");
      expect(typeof a.allocatedResourceName).toBe("string");
      expect(typeof a.allocatedMethodId).toBe("string");
      expect(typeof a.allocatedMethodDetails).toBe("string");
      expect(typeof a.allocatedCost).toBe("number");
      expect(typeof a.allocationFraction).toBe("number");
      expect(typeof a.allocatedTags).toBe("object");
    }
  });
});

// ─── requestId propagation ────────────────────────────────────────────────────

describe("billing.chargeback.allocate — requestId", () => {
  it("requestId is present in success response", async () => {
    const res = await callChargeback("aws");
    expect(typeof res.json().requestId).toBe("string");
    expect(res.json().requestId.length).toBeGreaterThan(0);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe("billing.chargeback.allocate — error paths", () => {
  it("returns 404 for an unknown tool id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/billing.chargeback.unknown/call",
      payload: { input: { provider: "aws", periodStart: "2026-01-01", periodEnd: "2026-02-01" } },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 500 with TOOL_EXECUTION_FAILED for unsupported provider", async () => {
    const res = await callChargeback("snowflake");
    expect(res.statusCode).toBe(500);
    expect(res.json().error?.code ?? res.json().code).toBe("TOOL_EXECUTION_FAILED");
  });

  it("returns 400 when input is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/billing.chargeback.allocate/call",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 500 with TOOL_EXECUTION_FAILED for an unknown resourceId", async () => {
    const res = await callChargeback("aws", { resourceId: "non-existent-resource" });
    expect(res.statusCode).toBe(500);
    expect(res.json().error?.code ?? res.json().code).toBe("TOOL_EXECUTION_FAILED");
  });
});
