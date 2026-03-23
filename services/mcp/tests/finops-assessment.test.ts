// ─── finops.assessment.run MCP Tool Tests ─────────────────────────────────────
//
// Phase 9 integration tests for finops.assessment.run.
// Uses app.inject() — no live port, no external dependencies.

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

async function callAssessment(extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/mcp/v1/tools/finops.assessment.run/call",
    payload: {
      input: {
        workspaceId: "ws-test-001",
        periodStart: "2026-01-01",
        periodEnd: "2026-02-01",
        ...extra,
      },
    },
  });
}

// ─── Tool registration ────────────────────────────────────────────────────────

describe("finops.assessment.run — registration", () => {
  it("health toolCount is now 23", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().toolCount).toBe(23);
  });

  it("tool appears in capabilities under finops namespace", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const finopsNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "finops",
    );
    expect(finopsNs).toBeDefined();
  });

  it("finops namespace has stability: beta", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const finopsNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "finops",
    );
    expect(finopsNs?.stability).toBe("beta");
  });
});

// ─── Zero signals — all crawl ──────────────────────────────────────────────────

describe("finops.assessment.run — zero signals (all crawl)", () => {
  it("returns 200", async () => {
    const res = await callAssessment();
    expect(res.statusCode).toBe(200);
  });

  it("overallMaturityLevel is crawl with no signals", async () => {
    const res = await callAssessment();
    expect(res.json().output.overallMaturityLevel).toBe("crawl");
  });

  it("overallScore is 0 with no signals", async () => {
    const res = await callAssessment();
    expect(res.json().output.overallScore).toBe(0);
  });

  it("returns 6 capability assessments", async () => {
    const res = await callAssessment();
    expect(res.json().output.capabilities).toHaveLength(6);
  });

  it("all domain scores are 0", async () => {
    const res = await callAssessment();
    const caps = res.json().output.capabilities;
    for (const cap of caps) {
      expect(cap.score).toBe(0);
    }
  });

  it("all domains have crawl maturity", async () => {
    const res = await callAssessment();
    const caps = res.json().output.capabilities;
    for (const cap of caps) {
      expect(cap.maturityLevel).toBe("crawl");
    }
  });

  it("topRecommendations has at most 3 entries", async () => {
    const res = await callAssessment();
    expect(res.json().output.topRecommendations.length).toBeLessThanOrEqual(3);
  });

  it("topRecommendations are non-empty strings", async () => {
    const res = await callAssessment();
    const recs = res.json().output.topRecommendations;
    for (const rec of recs) {
      expect(typeof rec).toBe("string");
      expect(rec.length).toBeGreaterThan(0);
    }
  });

  it("ingestMode is deterministic", async () => {
    const res = await callAssessment();
    expect(res.json().output.ingestMode).toBe("deterministic");
  });

  it("assessmentVersion is 2026.1", async () => {
    const res = await callAssessment();
    expect(res.json().output.assessmentVersion).toBe("2026.1");
  });

  it("workspaceId is echoed back", async () => {
    const res = await callAssessment({ workspaceId: "ws-test-001" });
    expect(res.json().output.workspaceId).toBe("ws-test-001");
  });

  it("periodStart and periodEnd are echoed back", async () => {
    const res = await callAssessment();
    expect(res.json().output.periodStart).toBe("2026-01-01");
    expect(res.json().output.periodEnd).toBe("2026-02-01");
  });

  it("computedAt is a valid ISO 8601 string", async () => {
    const res = await callAssessment();
    const computedAt = res.json().output.computedAt as string;
    expect(new Date(computedAt).toISOString()).toBe(computedAt);
  });
});

// ─── Full signals — all run ────────────────────────────────────────────────────

describe("finops.assessment.run — all signals true (all run)", () => {
  const allTrue = {
    hasTaggingPolicy: true,
    hasSharedCostAllocation: true,
    hasCostDashboard: true,
    hasUnitEconomics: true,
    hasAnomalyDetection: true,
    hasProductCostMapping: true,
    hasExecutiveReporting: true,
    hasRoiTracking: true,
    hasShowbackOrChargeback: true,
    hasCommitmentCoverage: true,
    hasRightsizing: true,
    hasWasteRemediation: true,
    hasSpotUsage: true,
    hasStorageLifecycle: true,
    hasFinOpsTeam: true,
    hasBudgetProcess: true,
    hasKpiTracking: true,
    hasEngineerVisibility: true,
    hasMaturityReview: true,
    hasCarbonVisibility: true,
    hasSustainabilityTargets: true,
    hasGreenRegionPolicy: true,
    hasAiCostVisibility: true,
    hasTokenAttribution: true,
    hasModelCostOptimization: true,
    hasAiCostAlerts: true,
  };

  it("returns 200", async () => {
    const res = await callAssessment(allTrue);
    expect(res.statusCode).toBe(200);
  });

  it("overallMaturityLevel is run when all signals true", async () => {
    const res = await callAssessment(allTrue);
    expect(res.json().output.overallMaturityLevel).toBe("run");
  });

  it("overallScore is 100 when all signals true", async () => {
    const res = await callAssessment(allTrue);
    expect(res.json().output.overallScore).toBe(100);
  });

  it("all domain scores are 100", async () => {
    const res = await callAssessment(allTrue);
    const caps = res.json().output.capabilities;
    for (const cap of caps) {
      expect(cap.score).toBe(100);
    }
  });

  it("all domains have run maturity", async () => {
    const res = await callAssessment(allTrue);
    const caps = res.json().output.capabilities;
    for (const cap of caps) {
      expect(cap.maturityLevel).toBe("run");
    }
  });
});

// ─── Specific domain coverage ─────────────────────────────────────────────────

describe("finops.assessment.run — domain coverage", () => {
  it("capabilities include all 6 FinOps Framework 2026 domains", async () => {
    const res = await callAssessment();
    const domains = res.json().output.capabilities.map(
      (c: { domain: string }) => c.domain,
    );
    expect(domains).toContain("understand-cloud-usage-cost");
    expect(domains).toContain("quantify-business-value");
    expect(domains).toContain("optimize-cloud-usage-cost");
    expect(domains).toContain("manage-finops-practice");
    expect(domains).toContain("cloud-sustainability");
    expect(domains).toContain("ai-ml-cost-management");
  });

  it("each capability has domainName, maturityLevel, score, findings, recommendations", async () => {
    const res = await callAssessment();
    const caps = res.json().output.capabilities;
    for (const cap of caps) {
      expect(typeof cap.domain).toBe("string");
      expect(typeof cap.domainName).toBe("string");
      expect(["crawl", "walk", "run"]).toContain(cap.maturityLevel);
      expect(typeof cap.score).toBe("number");
      expect(cap.score).toBeGreaterThanOrEqual(0);
      expect(cap.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(cap.findings)).toBe(true);
      expect(Array.isArray(cap.recommendations)).toBe(true);
    }
  });

  it("understand domain scores 100 when all 5 understand signals true", async () => {
    const res = await callAssessment({
      hasTaggingPolicy: true,
      hasSharedCostAllocation: true,
      hasCostDashboard: true,
      hasUnitEconomics: true,
      hasAnomalyDetection: true,
    });
    const caps = res.json().output.capabilities;
    const understand = caps.find(
      (c: { domain: string }) => c.domain === "understand-cloud-usage-cost",
    );
    expect(understand.score).toBe(100);
    expect(understand.maturityLevel).toBe("run");
  });

  it("ai-ml domain scores 50 when 2 of 4 ai signals true", async () => {
    const res = await callAssessment({
      hasAiCostVisibility: true,
      hasTokenAttribution: true,
    });
    const caps = res.json().output.capabilities;
    const aiMl = caps.find(
      (c: { domain: string }) => c.domain === "ai-ml-cost-management",
    );
    expect(aiMl.score).toBe(50);
    expect(aiMl.maturityLevel).toBe("walk");
  });

  it("sustainability scores 33 when only carbon visibility is true (1 of 3)", async () => {
    const res = await callAssessment({ hasCarbonVisibility: true });
    const caps = res.json().output.capabilities;
    const sustainability = caps.find(
      (c: { domain: string }) => c.domain === "cloud-sustainability",
    );
    expect(sustainability.score).toBe(33);
    expect(sustainability.maturityLevel).toBe("crawl");
  });
});

// ─── Mixed signals — overall scoring ─────────────────────────────────────────

describe("finops.assessment.run — mixed signals", () => {
  it("overallScore is average of domain scores", async () => {
    // Only understand domain is fully true (5/5=100); rest are 0.
    // Average = 100/6 ≈ 17
    const res = await callAssessment({
      hasTaggingPolicy: true,
      hasSharedCostAllocation: true,
      hasCostDashboard: true,
      hasUnitEconomics: true,
      hasAnomalyDetection: true,
    });
    const { overallScore } = res.json().output;
    expect(overallScore).toBe(Math.round(100 / 6));
  });

  it("overall maturity is walk when majority of domains are walk", async () => {
    // understand: 2/5=40 walk, quantify: 2/4=50 walk, optimize: 2/5=40 walk,
    // managePractice: 2/5=40 walk, sustainability: 0 crawl, aiMl: 0 crawl
    const res = await callAssessment({
      hasTaggingPolicy: true,
      hasCostDashboard: true, // understand: 40 walk
      hasProductCostMapping: true,
      hasExecutiveReporting: true, // quantify: 50 walk
      hasCommitmentCoverage: true,
      hasRightsizing: true, // optimize: 40 walk
      hasFinOpsTeam: true,
      hasBudgetProcess: true, // managePractice: 40 walk
    });
    const { overallMaturityLevel } = res.json().output;
    expect(overallMaturityLevel).toBe("walk");
  });
});

// ─── Result envelope ──────────────────────────────────────────────────────────

describe("finops.assessment.run — result envelope", () => {
  it("toolId is finops.assessment.run", async () => {
    const res = await callAssessment();
    expect(res.json().toolId).toBe("finops.assessment.run");
  });

  it("requestId is present", async () => {
    const res = await callAssessment();
    const { requestId } = res.json();
    expect(typeof requestId).toBe("string");
    expect(requestId.length).toBeGreaterThan(0);
  });

  it("requestId echoes x-request-id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/finops.assessment.run/call",
      headers: { "x-request-id": "finops-test-req-001" },
      payload: {
        input: {
          workspaceId: "ws-test-001",
          periodStart: "2026-01-01",
          periodEnd: "2026-02-01",
        },
      },
    });
    expect(res.json().requestId).toBe("finops-test-req-001");
  });

  it("executedAt is a valid ISO 8601 string", async () => {
    const res = await callAssessment();
    const { executedAt } = res.json();
    expect(new Date(executedAt).toISOString()).toBe(executedAt);
  });

  it("warnings array includes deterministic notice", async () => {
    const res = await callAssessment();
    const { warnings } = res.json();
    expect(Array.isArray(warnings)).toBe(true);
    expect(
      warnings.some((w: string) => w.toLowerCase().includes("deterministic")),
    ).toBe(true);
  });

  it("appliedIds include engine version and maturity level", async () => {
    const res = await callAssessment();
    const { appliedIds } = res.json();
    expect(Array.isArray(appliedIds)).toBe(true);
    expect(appliedIds.some((id: string) => id.includes("2026.1"))).toBe(true);
    expect(appliedIds.some((id: string) => id.includes("crawl"))).toBe(true);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe("finops.assessment.run — error paths", () => {
  it("returns 404 for unknown tool id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/finops.assessment.unknown/call",
      payload: {
        input: { periodStart: "2026-01-01", periodEnd: "2026-02-01" },
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when input is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/finops.assessment.run/call",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
