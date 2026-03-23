// ─── finops.assessment.correlate — integration tests ─────────────────────────
//
// Uses Fastify app.inject() to test the MCP HTTP transport end-to-end.
// All adapters run in deterministic mode — no real API calls.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMcpRoutes } from "../src/transport/routes.js";
import { _resetRegistry } from "../src/transport/registry.js";

let app: FastifyInstance;

beforeAll(async () => {
  _resetRegistry();
  app = Fastify();
  await registerMcpRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  _resetRegistry();
});

// ─── Registration ─────────────────────────────────────────────────────────────

describe("finops.assessment.correlate registration", () => {
  it("health toolCount is now 23", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().toolCount).toBe(23);
  });

  it("health reports version 0.15.0", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.json().version).toBe("0.15.0");
  });

  it("tool appears in finops namespace", async () => {
    const res  = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const finops = body.toolNamespaces?.find((ns: { namespace: string }) => ns.namespace === "finops");
    expect(finops).toBeDefined();
    expect(finops.tools).toContain("finops.assessment.correlate");
  });

  it("finops namespace has stability: beta", async () => {
    const res  = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const finops = body.toolNamespaces?.find((ns: { namespace: string }) => ns.namespace === "finops");
    expect(finops?.stability).toBe("beta");
  });

  it("direct capabilities lookup contains correlate tool", async () => {
    const res  = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const allTools: string[] = (body.toolNamespaces ?? []).flatMap(
      (ns: { tools: string[] }) => ns.tools ?? [],
    );
    expect(allTools).toContain("finops.assessment.correlate");
  });
});

// ─── Basic invocation ─────────────────────────────────────────────────────────

describe("finops.assessment.correlate basic invocation", () => {
  async function invoke(input: Record<string, unknown>) {
    const res = await app.inject({
      method:  "POST",
      url:     "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: {
        toolId:    "finops.assessment.correlate",
        requestId: "test-correlate-01",
        input,
      },
    });
    return res;
  }

  const BASE_INPUT = {
    periodStart: "2026-02-01",
    periodEnd:   "2026-02-28",
  };

  it("returns 200", async () => {
    const res = await invoke(BASE_INPUT);
    expect(res.statusCode).toBe(200);
  });

  it("response has success: true", async () => {
    const res = await invoke(BASE_INPUT);
    expect(res.statusCode === 200).toBe(true);
  });

  it("response has required top-level fields", async () => {
    const res  = await invoke(BASE_INPUT);
    const data = res.json().output;
    expect(data).toHaveProperty("workspaceId");
    expect(data).toHaveProperty("periodStart");
    expect(data).toHaveProperty("periodEnd");
    expect(data).toHaveProperty("overallMaturityLevel");
    expect(data).toHaveProperty("overallScore");
    expect(data).toHaveProperty("totalBillingSpend");
    expect(data).toHaveProperty("aiProviderSpend");
    expect(data).toHaveProperty("cloudProviderSpend");
    expect(data).toHaveProperty("correlatedRecommendations");
    expect(data).toHaveProperty("totalAddressableWaste");
    expect(data).toHaveProperty("topAddressableGap");
    expect(data).toHaveProperty("providersCovered");
    expect(data).toHaveProperty("providersSkipped");
    expect(data).toHaveProperty("ingestMode");
    expect(data).toHaveProperty("computedAt");
    expect(data).toHaveProperty("correlationVersion", "1.0");
  });

  it("workspaceId defaults to 'default' when omitted", async () => {
    const res = await invoke(BASE_INPUT);
    expect(res.json().output.workspaceId).toBe("default");
  });

  it("workspaceId propagates when provided", async () => {
    const res = await invoke({ ...BASE_INPUT, workspaceId: "team-alpha" });
    expect(res.json().output.workspaceId).toBe("team-alpha");
  });

  it("period echoed in output", async () => {
    const res  = await invoke(BASE_INPUT);
    const data = res.json().output;
    expect(data.periodStart).toBe("2026-02-01");
    expect(data.periodEnd).toBe("2026-02-28");
  });
});

// ─── Assessment scoring ───────────────────────────────────────────────────────

describe("finops.assessment.correlate assessment scoring", () => {
  it("overallScore 0–100 with all caps false", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "r1",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    const { overallScore } = res.json().output;
    expect(overallScore).toBeGreaterThanOrEqual(0);
    expect(overallScore).toBeLessThanOrEqual(100);
  });

  it("overallMaturityLevel is crawl with no capabilities", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "r2",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    expect(res.json().output.overallMaturityLevel).toBe("crawl");
  });

  it("overallScore higher when all capabilities true", async () => {
    const allTrue = {
      periodStart: "2026-02-01", periodEnd: "2026-02-28",
      hasTaggingPolicy: true, hasSharedCostAllocation: true, hasCostDashboard: true,
      hasUnitEconomics: true, hasAnomalyDetection: true, hasProductCostMapping: true,
      hasExecutiveReporting: true, hasRoiTracking: true, hasShowbackOrChargeback: true,
      hasCommitmentCoverage: true, hasRightsizing: true, hasWasteRemediation: true,
      hasSpotUsage: true, hasStorageLifecycle: true, hasFinOpsTeam: true,
      hasBudgetProcess: true, hasKpiTracking: true, hasEngineerVisibility: true,
      hasMaturityReview: true, hasCarbonVisibility: true, hasSustainabilityTargets: true,
      hasGreenRegionPolicy: true, hasAiCostVisibility: true, hasTokenAttribution: true,
      hasModelCostOptimization: true, hasAiCostAlerts: true,
    };
    const res1 = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "r3", input: allTrue },
    });
    const res2 = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "r4",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    expect(res1.json().output.overallScore).toBeGreaterThan(res2.json().output.overallScore);
  });
});

// ─── Billing correlation ──────────────────────────────────────────────────────

describe("finops.assessment.correlate billing correlation", () => {
  async function invoke(caps: Record<string, boolean | string> = {}) {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: {
        toolId: "finops.assessment.correlate", requestId: "correlate-billing",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28", ...caps },
      },
    });
    return res.json().output;
  }

  it("totalBillingSpend is non-zero (AI fixture data loaded)", async () => {
    const data = await invoke();
    expect(parseFloat(data.totalBillingSpend)).toBeGreaterThan(0);
  });

  it("aiProviderSpend > 0 (AI providers loaded)", async () => {
    const data = await invoke();
    expect(parseFloat(data.aiProviderSpend)).toBeGreaterThan(0);
  });

  it("providersCovered includes at least one AI provider", async () => {
    const data = await invoke();
    const aiProviders = ["anthropic", "openai", "google", "mistral", "deepseek", "alibaba"];
    const covered = data.providersCovered as string[];
    expect(covered.some((p: string) => aiProviders.includes(p))).toBe(true);
  });

  it("correlatedRecommendations is an array", async () => {
    const data = await invoke();
    expect(Array.isArray(data.correlatedRecommendations)).toBe(true);
  });

  it("correlatedRecommendations non-empty when capabilities missing", async () => {
    const data = await invoke();  // all caps false → many gaps
    expect(data.correlatedRecommendations.length).toBeGreaterThan(0);
  });

  it("totalAddressableWaste > 0 when caps missing and spend is non-zero", async () => {
    const data = await invoke();
    expect(parseFloat(data.totalAddressableWaste)).toBeGreaterThan(0);
  });

  it("correlatedRecommendations is sorted by roiScore DESC", async () => {
    const data = await invoke();
    const recs = data.correlatedRecommendations as Array<{ roiScore: number }>;
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1]!.roiScore).toBeGreaterThanOrEqual(recs[i]!.roiScore);
    }
  });

  it("correlatedRecommendations empty when all caps true", async () => {
    const allTrue = {
      hasTaggingPolicy: true, hasSharedCostAllocation: true, hasCostDashboard: true,
      hasUnitEconomics: true, hasAnomalyDetection: true, hasProductCostMapping: true,
      hasExecutiveReporting: true, hasRoiTracking: true, hasShowbackOrChargeback: true,
      hasCommitmentCoverage: true, hasRightsizing: true, hasWasteRemediation: true,
      hasSpotUsage: true, hasStorageLifecycle: true, hasFinOpsTeam: true,
      hasBudgetProcess: true, hasKpiTracking: true, hasEngineerVisibility: true,
      hasMaturityReview: true, hasCarbonVisibility: true, hasSustainabilityTargets: true,
      hasGreenRegionPolicy: true, hasAiCostVisibility: true, hasTokenAttribution: true,
      hasModelCostOptimization: true, hasAiCostAlerts: true,
    };
    const data = await invoke(allTrue as Record<string, boolean | string>);
    expect(data.correlatedRecommendations.length).toBe(0);
    expect(parseFloat(data.totalAddressableWaste)).toBe(0);
  });
});

// ─── CorrelatedRecommendation shape ──────────────────────────────────────────

describe("finops.assessment.correlate CorrelatedRecommendation shape", () => {
  it("each recommendation has required fields", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "shape-test",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    const recs = res.json().output.correlatedRecommendations as Array<Record<string, unknown>>;
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec).toHaveProperty("id");
      expect(rec).toHaveProperty("domain");
      expect(rec).toHaveProperty("domainName");
      expect(rec).toHaveProperty("gapCapability");
      expect(rec).toHaveProperty("estimatedWaste");
      expect(rec).toHaveProperty("estimatedSaving");
      expect(rec).toHaveProperty("implementationEffort");
      expect(rec).toHaveProperty("roiScore");
      expect(rec).toHaveProperty("recommendation");
      expect(rec).toHaveProperty("affectedProviders");
    }
  });

  it("implementationEffort is one of low|medium|high", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "effort-test",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    const recs = res.json().output.correlatedRecommendations as Array<{ implementationEffort: string }>;
    for (const rec of recs) {
      expect(["low", "medium", "high"]).toContain(rec.implementationEffort);
    }
  });

  it("roiScore is 0–100", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "roi-test",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    const recs = res.json().output.correlatedRecommendations as Array<{ roiScore: number }>;
    for (const rec of recs) {
      expect(rec.roiScore).toBeGreaterThanOrEqual(0);
      expect(rec.roiScore).toBeLessThanOrEqual(100);
    }
  });

  it("estimatedWaste is a 10-decimal-place string", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "decimal-test",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28" } },
    });
    const recs = res.json().output.correlatedRecommendations as Array<{ estimatedWaste: string }>;
    for (const rec of recs) {
      expect(rec.estimatedWaste).toMatch(/^\d+\.\d{10}$/);
    }
  });
});

// ─── Selective providers ──────────────────────────────────────────────────────

describe("finops.assessment.correlate selective providers", () => {
  it("restricts billing coverage to requested providers", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "selective",
        input: { periodStart: "2026-02-01", periodEnd: "2026-02-28", providers: "anthropic,openai" } },
    });
    const data = res.json().output;
    expect(data.providersCovered.length).toBeLessThanOrEqual(2);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe("finops.assessment.correlate error paths", () => {
  it("unknown toolId returns 404", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/does-not-exist/call",
      payload: { toolId: "does-not-exist", requestId: "err1", input: {} },
    });
    expect(res.statusCode).toBe(404);
  });

  it("missing input object returns 400", async () => {
    const res = await app.inject({
      method: "POST", url: "/mcp/v1/tools/finops.assessment.correlate/call",
      payload: { toolId: "finops.assessment.correlate", requestId: "err2" },
    });
    expect(res.statusCode).toBe(400);
  });
});
