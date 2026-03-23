// ─── MCP Transport Tests ──────────────────────────────────────────────────────
//
// Integration tests for the Fastify MCP transport layer.
// Uses app.inject() — no live port, no network, no external dependencies.
// Covers: health, capabilities, tool call (happy path + error paths).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";
import { _resetRegistry } from "../src/transport/registry.js";

// ─── Shared app fixture ────────────────────────────────────────────────────────

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

// ─── Health ───────────────────────────────────────────────────────────────────

describe("GET /mcp/v1/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("@ficecal/service-mcp");
    expect(body.phase).toBe(12);
  });

  it("reports 23 registered tools (phase 5-12)", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    const body = res.json();
    expect(body.toolCount).toBe(23);
  });

  it("reports economics and health namespaces", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    const body = res.json();
    expect(body.namespaces).toContain("economics");
    expect(body.namespaces).toContain("health");
  });
});

// ─── Capabilities ─────────────────────────────────────────────────────────────

describe("GET /mcp/v1/capabilities", () => {
  it("returns 200 with mcpVersion", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mcpVersion).toBe("2.0");
  });

  it("includes economics namespace with cost and period tools", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const economicsNs = body.toolNamespaces.find(
      (ns: { namespace: string }) => ns.namespace === "economics"
    );
    expect(economicsNs).toBeDefined();
    expect(economicsNs.tools).toContain("economics.estimate.cost");
    expect(economicsNs.tools).toContain("economics.period.normalize");
  });

  it("includes health namespace with health.score.query", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const healthNs = body.toolNamespaces.find(
      (ns: { namespace: string }) => ns.namespace === "health"
    );
    expect(healthNs).toBeDefined();
    expect(healthNs.tools).toContain("health.score.query");
  });

  it("includes billing namespace", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const billingNs = body.toolNamespaces.find(
      (ns: { namespace: string }) => ns.namespace === "billing"
    );
    expect(billingNs).toBeDefined();
    expect(billingNs.tools).toContain("billing.estimate.actual");
    expect(billingNs.tools).toContain("billing.compare.period");
  });
});

// ─── Tool: economics.estimate.cost ────────────────────────────────────────────

describe("POST /mcp/v1/tools/economics.estimate.cost/call", () => {
  it("computes token cost and returns totalCost", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      payload: {
        input: {
          pricingUnit: "per_1m_tokens",
          inputTokens: 1_000_000,
          outputTokens: 500_000,
          inputPricePerUnit: "0.50",
          outputPricePerUnit: "1.50",
          currency: "USD",
          period: "monthly",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.toolId).toBe("economics.estimate.cost");
    expect(typeof body.output.totalCost).toBe("string");
    expect(parseFloat(body.output.totalCost)).toBeGreaterThan(0);
    expect(body.output.currency).toBe("USD");
    expect(body.output.period).toBe("monthly");
  });

  it("returns breakdown with input and output lines", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      payload: {
        input: {
          pricingUnit: "per_1m_tokens",
          inputTokens: 2_000_000,
          outputTokens: 1_000_000,
          inputPricePerUnit: "1.00",
          outputPricePerUnit: "2.00",
          currency: "USD",
          period: "monthly",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(Array.isArray(output.breakdown)).toBe(true);
    expect(output.breakdown.length).toBeGreaterThanOrEqual(1);
    expect(output.formulasApplied.length).toBeGreaterThan(0);
  });

  it("computes per_request pricing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      payload: {
        input: {
          pricingUnit: "per_request",
          requestCount: 10_000,
          pricePerRequest: "0.001",
          currency: "MUR",
          period: "monthly",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(parseFloat(output.totalCost)).toBeCloseTo(10, 0);
  });

  it("computes per_image pricing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      payload: {
        input: {
          pricingUnit: "per_image",
          imageCount: 100,
          pricePerImage: "0.040",
          currency: "USD",
          period: "monthly",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(parseFloat(output.totalCost)).toBeCloseTo(4.0, 1);
  });

  it("computes per_second pricing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      payload: {
        input: {
          pricingUnit: "per_second",
          durationSeconds: 3600,
          pricePerSecond: "0.01",
          currency: "USD",
          period: "monthly",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(parseFloat(output.totalCost)).toBeCloseTo(36, 0);
  });

  it("echoes the requestId from x-request-id header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      headers: { "x-request-id": "test-req-001" },
      payload: {
        input: {
          pricingUnit: "per_1m_tokens",
          inputTokens: 100_000,
          inputPricePerUnit: "0.50",
          currency: "USD",
          period: "monthly",
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().requestId).toBe("test-req-001");
  });
});

// ─── Tool: economics.period.normalize ────────────────────────────────────────

describe("POST /mcp/v1/tools/economics.period.normalize/call", () => {
  it("converts monthly to annual", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.period.normalize/call",
      payload: {
        input: { amount: "1500.00", fromPeriod: "monthly", toPeriod: "annual" },
      },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(parseFloat(output.normalizedAmount)).toBeCloseTo(18000, 0);
    expect(output.fromPeriod).toBe("monthly");
    expect(output.toPeriod).toBe("annual");
    expect(output.formulasApplied).toContain("period.normalize");
  });

  it("converts daily to monthly", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.period.normalize/call",
      payload: {
        input: { amount: "50.00", fromPeriod: "daily", toPeriod: "monthly" },
      },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    // 50/day * ~30.44 days/month ≈ 1522
    expect(parseFloat(output.normalizedAmount)).toBeGreaterThan(1500);
  });

  it("identity conversion returns same amount", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.period.normalize/call",
      payload: {
        input: { amount: "999.99", fromPeriod: "monthly", toPeriod: "monthly" },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(parseFloat(res.json().output.normalizedAmount)).toBeCloseTo(999.99, 2);
  });
});

// ─── Tool: health.score.query ─────────────────────────────────────────────────

describe("POST /mcp/v1/tools/health.score.query/call", () => {
  const baseSignals = [
    {
      signal: {
        id: "pricing-freshness-ok",
        category: "pricing-freshness",
        label: "Pricing freshness",
        score: 95,
        severity: "ok",
        rationale: "Data is current",
      },
      weight: 2,
    },
    {
      signal: {
        id: "data-completeness-ok",
        category: "data-completeness",
        label: "Data completeness",
        score: 85,
        severity: "ok",
        rationale: "All required fields present",
      },
      weight: 1,
    },
  ];

  it("returns a weightedScore between 0 and 100", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/health.score.query/call",
      payload: { input: { signals: baseSignals } },
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(output.weightedScore).toBeGreaterThan(0);
    expect(output.weightedScore).toBeLessThanOrEqual(100);
  });

  it("derives overallSeverity from signals", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/health.score.query/call",
      payload: { input: { signals: baseSignals } },
    });
    const { output } = res.json();
    expect(["ok", "warning", "critical"]).toContain(output.overallSeverity);
  });

  it("returns ok severity for all-green signals", async () => {
    const allOk = [
      {
        signal: {
          id: "sig-1",
          category: "pricing-freshness",
          label: "Fresh",
          score: 100,
          severity: "ok",
          rationale: "All good",
        },
        weight: 1,
      },
    ];
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/health.score.query/call",
      payload: { input: { signals: allOk } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().output.overallSeverity).toBe("ok");
  });

  it("returns critical severity for low-score signals", async () => {
    const critical = [
      {
        signal: {
          id: "sig-crit",
          category: "data-completeness",
          label: "Missing data",
          score: 10,
          severity: "critical",
          rationale: "Data is missing",
        },
        weight: 3,
      },
    ];
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/health.score.query/call",
      payload: { input: { signals: critical } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().output.overallSeverity).toBe("critical");
  });

  it("includes recommendations array in output", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/health.score.query/call",
      payload: { input: { signals: baseSignals } },
    });
    const { output } = res.json();
    expect(Array.isArray(output.recommendations)).toBe(true);
  });

  it("toolId is health.score.query", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/health.score.query/call",
      payload: { input: { signals: baseSignals } },
    });
    expect(res.json().toolId).toBe("health.score.query");
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe("Error handling", () => {
  it("returns 404 for unknown toolId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/does.not.exist/call",
      payload: { input: {} },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("TOOL_NOT_FOUND");
  });

  it("returns 400 when input is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.estimate.cost/call",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 when input is not an object", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.period.normalize/call",
      payload: { input: "not-an-object" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_REQUEST");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/unknown-path" });
    expect(res.statusCode).toBe(404);
  });
});

// ─── Context propagation ──────────────────────────────────────────────────────

describe("Context propagation", () => {
  it("uses x-workspace-id header in context", async () => {
    // The workspaceId doesn't affect output but the request should succeed
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.period.normalize/call",
      headers: {
        "x-workspace-id": "ws-test-999",
        "x-request-id": "ctx-test-001",
        "x-mcp-mode": "architect",
      },
      payload: {
        input: { amount: "100.00", fromPeriod: "monthly", toPeriod: "annual" },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().requestId).toBe("ctx-test-001");
  });

  it("generates a requestId when x-request-id is absent", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/economics.period.normalize/call",
      payload: {
        input: { amount: "50.00", fromPeriod: "daily", toPeriod: "monthly" },
      },
    });
    expect(res.statusCode).toBe(200);
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(res.json().requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});
