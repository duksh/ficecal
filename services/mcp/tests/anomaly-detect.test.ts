// ─── billing.anomaly.detect MCP Tool Tests ────────────────────────────────────
//
// Phase 10A P0 integration tests for billing.anomaly.detect.
// Uses app.inject() — no live port, no external dependencies.
// Fixture providers (aws, gcp, azure, openai) are pre-registered in registry.ts.

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

async function callAnomaly(input: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/mcp/v1/tools/billing.anomaly.detect/call",
    payload: { input },
  });
}

const BASE_INPUT = {
  providers: ["aws"],
  currentPeriodStart:  "2026-02-01",
  currentPeriodEnd:    "2026-02-28",
  baselinePeriodStart: "2026-01-01",
  baselinePeriodEnd:   "2026-01-31",
};

// ─── Registration ─────────────────────────────────────────────────────────────

describe("billing.anomaly.detect registration", () => {
  it("appears in capabilities manifest under billing namespace", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const billingNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "billing",
    );
    expect(billingNs).toBeDefined();
  });

  it("is in the billing namespace tool list", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const billingNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "billing",
    );
    // tools is string[] of tool IDs in this namespace
    expect(billingNs?.tools).toContain("billing.anomaly.detect");
  });

  it("billing namespace reports stability: beta", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/capabilities" });
    const body = res.json();
    const billingNs = body.toolNamespaces?.find(
      (ns: { namespace: string }) => ns.namespace === "billing",
    );
    expect(billingNs?.stability).toBe("beta");
  });

  it("health toolCount is now 23", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().toolCount).toBe(23);
  });

  it("health reports phase 12", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.json().phase).toBe(12);
  });

  it("health reports version 0.15.0", async () => {
    const res = await app.inject({ method: "GET", url: "/mcp/v1/health" });
    expect(res.json().version).toBe("0.15.0");
  });
});

// ─── Basic invocation ─────────────────────────────────────────────────────────

describe("billing.anomaly.detect — basic invocation", () => {
  it("returns 200 with fixture data", async () => {
    const res = await callAnomaly(BASE_INPUT);
    expect(res.statusCode).toBe(200);
  });

  it("output has required envelope fields", async () => {
    const res = await callAnomaly(BASE_INPUT);
    const body = res.json();
    expect(body.toolId).toBe("billing.anomaly.detect");
    expect(body.executedAt).toBeDefined();
    expect(body.requestId).toBeDefined();
    expect(body.warnings).toBeInstanceOf(Array);
    expect(body.appliedIds).toBeInstanceOf(Array);
  });

  it("appliedIds includes threshold and severity rules", async () => {
    const res = await callAnomaly(BASE_INPUT);
    const { appliedIds } = res.json();
    expect(appliedIds).toContain("billing.anomaly.threshold.relative-delta.v1");
    expect(appliedIds).toContain("billing.anomaly.severity.2x-critical");
  });

  it("output has all required top-level fields", async () => {
    const res = await callAnomaly(BASE_INPUT);
    const { output } = res.json();
    expect(output).toMatchObject({
      anomalies: expect.any(Array),
      totalCurrentSpend: expect.any(String),
      totalBaselineSpend: expect.any(String),
      totalDeltaPercent: expect.any(Number),
      overallSeverity: expect.stringMatching(/^(none|warning|critical)$/),
      currentPeriod: { start: "2026-02-01", end: "2026-02-28" },
      baselinePeriod: { start: "2026-01-01", end: "2026-01-31" },
      providersCovered: ["aws"],
      anomalyCount: expect.any(Number),
      thresholdPercent: 50,
      ingestMode: expect.stringMatching(/^(deterministic|live|mixed)$/),
    });
  });

  it("anomalyCount matches anomalies array length", async () => {
    const res = await callAnomaly(BASE_INPUT);
    const { output } = res.json();
    expect(output.anomalyCount).toBe(output.anomalies.length);
  });
});

// ─── Threshold behaviour ──────────────────────────────────────────────────────

describe("billing.anomaly.detect — threshold behaviour", () => {
  it("custom threshold 0 surfaces all services with any increase", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 0 });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    // With threshold 0, every service with current > baseline is flagged
    for (const anomaly of output.anomalies) {
      expect(parseFloat(anomaly.deltaPercent)).toBeGreaterThan(0);
    }
  });

  it("high threshold 999 surfaces no anomalies", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 999 });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(output.anomalies).toHaveLength(0);
    expect(output.overallSeverity).toBe("none");
    expect(output.anomalyCount).toBe(0);
  });

  it("thresholdPercent echoed in output", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 75 });
    expect(res.json().output.thresholdPercent).toBe(75);
  });
});

// ─── Multi-provider ───────────────────────────────────────────────────────────

describe("billing.anomaly.detect — multi-provider", () => {
  it("accepts multiple providers", async () => {
    const res = await callAnomaly({
      ...BASE_INPUT,
      providers: ["aws", "gcp"],
    });
    expect(res.statusCode).toBe(200);
    const { output } = res.json();
    expect(output.providersCovered).toContain("aws");
    expect(output.providersCovered).toContain("gcp");
  });

  it("unknown provider is silently skipped — still returns 200", async () => {
    const res = await callAnomaly({
      ...BASE_INPUT,
      providers: ["aws", "nonexistent-provider"],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().output.anomalyCount).toBeGreaterThanOrEqual(0);
  });

  it("all four fixture providers accepted", async () => {
    const res = await callAnomaly({
      ...BASE_INPUT,
      providers: ["aws", "gcp", "azure", "openai"],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().output.providersCovered).toHaveLength(4);
  });
});

// ─── AnomalyRecord shape ──────────────────────────────────────────────────────

describe("billing.anomaly.detect — AnomalyRecord shape", () => {
  it("each anomaly has required fields", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 0 });
    const { output } = res.json();
    for (const anomaly of output.anomalies) {
      expect(anomaly).toMatchObject({
        serviceName: expect.any(String),
        provider: expect.any(String),
        currentSpend: expect.any(String),
        baselineSpend: expect.any(String),
        deltaPercent: expect.any(Number),
        deltaAmount: expect.any(String),
        severity: expect.stringMatching(/^(warning|critical)$/),
        recommendation: expect.any(String),
      });
    }
  });

  it("severity is warning when deltaPercent between threshold and 100", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 0 });
    const { output } = res.json();
    for (const anomaly of output.anomalies) {
      if (anomaly.deltaPercent > 0 && anomaly.deltaPercent <= 100) {
        expect(anomaly.severity).toBe("warning");
      }
    }
  });

  it("severity is critical when deltaPercent > 100", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 0 });
    const { output } = res.json();
    for (const anomaly of output.anomalies) {
      if (anomaly.deltaPercent > 100) {
        expect(anomaly.severity).toBe("critical");
      }
    }
  });

  it("anomalies ranked by deltaAmount DESC", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 0 });
    const { output } = res.json();
    const deltas = output.anomalies.map((a: { deltaAmount: string }) => parseFloat(a.deltaAmount));
    for (let i = 1; i < deltas.length; i++) {
      expect(deltas[i - 1]).toBeGreaterThanOrEqual(deltas[i]);
    }
  });
});

// ─── Overall severity ─────────────────────────────────────────────────────────

describe("billing.anomaly.detect — overallSeverity", () => {
  it("overallSeverity is none when no anomalies found", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 999 });
    expect(res.json().output.overallSeverity).toBe("none");
  });

  it("overallSeverity is critical when any anomaly is critical", async () => {
    const res = await callAnomaly({ ...BASE_INPUT, thresholdPercent: 0 });
    const { output } = res.json();
    const hasCritical = output.anomalies.some((a: { severity: string }) => a.severity === "critical");
    if (hasCritical) {
      expect(output.overallSeverity).toBe("critical");
    }
  });
});

// ─── Warnings ─────────────────────────────────────────────────────────────────

describe("billing.anomaly.detect — warnings", () => {
  it("warnings array is non-empty", async () => {
    const res = await callAnomaly(BASE_INPUT);
    expect(res.json().warnings.length).toBeGreaterThan(0);
  });

  it("first warning mentions dataCompleteness partial", async () => {
    const res = await callAnomaly(BASE_INPUT);
    const [firstWarning] = res.json().warnings as string[];
    expect(firstWarning.toLowerCase()).toContain("partial");
  });

  it("partial-month warning added when current period < 28 days", async () => {
    const res = await callAnomaly({
      ...BASE_INPUT,
      currentPeriodStart: "2026-02-01",
      currentPeriodEnd:   "2026-02-07",  // 6 days — definitely partial
    });
    const warnings: string[] = res.json().warnings;
    expect(warnings.some((w) => w.toLowerCase().includes("projected"))).toBe(true);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe("billing.anomaly.detect — error paths", () => {
  it("returns 404 for unknown tool id", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/billing.anomaly.doesnotexist/call",
      payload: { input: {} },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when input object is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/mcp/v1/tools/billing.anomaly.detect/call",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
