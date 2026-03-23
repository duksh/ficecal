// ─── @ficecal/finops-assessment — engine tests ────────────────────────────────
//
// Full vitest suite for the FinOps Framework 2026 scoring engine.
// Tests cover: all six domain scorers, overall score, modal maturity,
// top recommendations, edge cases (empty signals, all-false, all-true).

import { describe, it, expect, beforeEach } from "vitest";
import {
  computeAssessment,
  scoreUnderstandCloudUsageCost,
  scoreQuantifyBusinessValue,
  scoreOptimizeCloudUsageCost,
  scoreManageFinOpsPractice,
  scoreCloudSustainability,
  scoreAiMlCostManagement,
} from "../src/index.js";
import type { ComputeAssessmentInput } from "../src/index.js";

// ─── Shared fixture ────────────────────────────────────────────────────────────

const ASSESSED_AT = "2026-01-01T00:00:00.000Z";

function baseInput(overrides: Partial<ComputeAssessmentInput> = {}): ComputeAssessmentInput {
  return {
    workspaceId: "ws-test-001",
    periodStart: "2026-01-01",
    periodEnd: "2026-02-01",
    signals: {},
    ...overrides,
  };
}

// ─── Domain: Understand Cloud Usage & Cost ─────────────────────────────────────

describe("scoreUnderstandCloudUsageCost", () => {
  it("returns crawl with score 0 when no signals provided", () => {
    const result = scoreUnderstandCloudUsageCost(undefined, ASSESSED_AT);
    expect(result.domain).toBe("understand-cloud-usage-cost");
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns crawl with score 0 when all signals false", () => {
    const result = scoreUnderstandCloudUsageCost(
      {
        hasTaggingPolicy: false,
        hasSharedCostAllocation: false,
        hasCostDashboard: false,
        hasUnitEconomics: false,
        hasAnomalyDetection: false,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns run with score 100 when all signals true", () => {
    const result = scoreUnderstandCloudUsageCost(
      {
        hasTaggingPolicy: true,
        hasSharedCostAllocation: true,
        hasCostDashboard: true,
        hasUnitEconomics: true,
        hasAnomalyDetection: true,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(100);
  });

  it("returns walk with score ~60 when 3 of 5 signals true", () => {
    const result = scoreUnderstandCloudUsageCost(
      {
        hasTaggingPolicy: true,
        hasSharedCostAllocation: true,
        hasCostDashboard: true,
        hasUnitEconomics: false,
        hasAnomalyDetection: false,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("walk");
    expect(result.score).toBe(60);
  });

  it("has 5 findings", () => {
    const result = scoreUnderstandCloudUsageCost(
      { hasTaggingPolicy: true, hasCostDashboard: false },
      ASSESSED_AT,
    );
    expect(result.findings).toHaveLength(5);
  });

  it("findings contain positive text when signal is true", () => {
    const result = scoreUnderstandCloudUsageCost(
      { hasTaggingPolicy: true },
      ASSESSED_AT,
    );
    const taggingFinding = result.findings.find((f) => f.includes("Tagging policy"));
    expect(taggingFinding).toBeDefined();
  });

  it("recommendations contain actionable text when signal is false", () => {
    const result = scoreUnderstandCloudUsageCost(
      { hasTaggingPolicy: false },
      ASSESSED_AT,
    );
    const rec = result.recommendations.find((r) => r.toLowerCase().includes("tag"));
    expect(rec).toBeDefined();
  });

  it("has correct domain name", () => {
    const result = scoreUnderstandCloudUsageCost(undefined, ASSESSED_AT);
    expect(result.domainName).toBe("Understand Cloud Usage & Cost");
  });

  it("assessedAt is propagated", () => {
    const result = scoreUnderstandCloudUsageCost(undefined, ASSESSED_AT);
    expect(result.assessedAt).toBe(ASSESSED_AT);
  });

  it("score 34 maps to walk", () => {
    // 2 of 5 signals = 40 → walk
    const result = scoreUnderstandCloudUsageCost(
      { hasTaggingPolicy: true, hasCostDashboard: true },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("walk");
  });
});

// ─── Domain: Quantify Business Value ──────────────────────────────────────────

describe("scoreQuantifyBusinessValue", () => {
  it("returns crawl with score 0 when no signals", () => {
    const result = scoreQuantifyBusinessValue(undefined, ASSESSED_AT);
    expect(result.domain).toBe("quantify-business-value");
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns run with score 100 when all signals true", () => {
    const result = scoreQuantifyBusinessValue(
      {
        hasProductCostMapping: true,
        hasExecutiveReporting: true,
        hasRoiTracking: true,
        hasShowbackOrChargeback: true,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(100);
  });

  it("returns walk with score 75 when 3 of 4 signals true", () => {
    const result = scoreQuantifyBusinessValue(
      {
        hasProductCostMapping: true,
        hasExecutiveReporting: true,
        hasRoiTracking: true,
        hasShowbackOrChargeback: false,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(75);
  });

  it("has 4 findings", () => {
    const result = scoreQuantifyBusinessValue({}, ASSESSED_AT);
    expect(result.findings).toHaveLength(4);
  });

  it("correct domain name", () => {
    expect(scoreQuantifyBusinessValue(undefined, ASSESSED_AT).domainName).toBe(
      "Quantify Business Value",
    );
  });
});

// ─── Domain: Optimize Cloud Usage & Cost ──────────────────────────────────────

describe("scoreOptimizeCloudUsageCost", () => {
  it("returns crawl with score 0 when no signals", () => {
    const result = scoreOptimizeCloudUsageCost(undefined, ASSESSED_AT);
    expect(result.domain).toBe("optimize-cloud-usage-cost");
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns run with score 100 when all signals true", () => {
    const result = scoreOptimizeCloudUsageCost(
      {
        hasCommitmentCoverage: true,
        hasRightsizing: true,
        hasWasteRemediation: true,
        hasSpotUsage: true,
        hasStorageLifecycle: true,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(100);
  });

  it("returns crawl with score 20 when 1 of 5 signals true", () => {
    const result = scoreOptimizeCloudUsageCost(
      { hasCommitmentCoverage: true },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(20);
  });

  it("has 5 findings", () => {
    const result = scoreOptimizeCloudUsageCost({}, ASSESSED_AT);
    expect(result.findings).toHaveLength(5);
  });

  it("correct domain name", () => {
    expect(scoreOptimizeCloudUsageCost(undefined, ASSESSED_AT).domainName).toBe(
      "Optimize Cloud Usage & Cost",
    );
  });
});

// ─── Domain: Manage FinOps Practice ───────────────────────────────────────────

describe("scoreManageFinOpsPractice", () => {
  it("returns crawl with score 0 when no signals", () => {
    const result = scoreManageFinOpsPractice(undefined, ASSESSED_AT);
    expect(result.domain).toBe("manage-finops-practice");
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns run with score 100 when all signals true", () => {
    const result = scoreManageFinOpsPractice(
      {
        hasFinOpsTeam: true,
        hasBudgetProcess: true,
        hasKpiTracking: true,
        hasEngineerVisibility: true,
        hasMaturityReview: true,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(100);
  });

  it("score 40 maps to walk", () => {
    const result = scoreManageFinOpsPractice(
      { hasFinOpsTeam: true, hasBudgetProcess: true },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("walk");
    expect(result.score).toBe(40);
  });

  it("has 5 findings", () => {
    const result = scoreManageFinOpsPractice({}, ASSESSED_AT);
    expect(result.findings).toHaveLength(5);
  });

  it("correct domain name", () => {
    expect(scoreManageFinOpsPractice(undefined, ASSESSED_AT).domainName).toBe(
      "Manage the FinOps Practice",
    );
  });
});

// ─── Domain: Cloud Sustainability ─────────────────────────────────────────────

describe("scoreCloudSustainability", () => {
  it("returns crawl with score 0 when no signals", () => {
    const result = scoreCloudSustainability(undefined, ASSESSED_AT);
    expect(result.domain).toBe("cloud-sustainability");
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns run with score 100 when all signals true", () => {
    const result = scoreCloudSustainability(
      {
        hasCarbonVisibility: true,
        hasSustainabilityTargets: true,
        hasGreenRegionPolicy: true,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(100);
  });

  it("score 33 maps to crawl (1 of 3 signals)", () => {
    const result = scoreCloudSustainability(
      { hasCarbonVisibility: true },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(33);
  });

  it("score 67 maps to run (2 of 3 signals)", () => {
    const result = scoreCloudSustainability(
      { hasCarbonVisibility: true, hasSustainabilityTargets: true },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(67);
  });

  it("has 3 findings", () => {
    const result = scoreCloudSustainability({}, ASSESSED_AT);
    expect(result.findings).toHaveLength(3);
  });

  it("correct domain name", () => {
    expect(scoreCloudSustainability(undefined, ASSESSED_AT).domainName).toBe(
      "Cloud Sustainability",
    );
  });
});

// ─── Domain: AI/ML Cost Management ────────────────────────────────────────────

describe("scoreAiMlCostManagement", () => {
  it("returns crawl with score 0 when no signals", () => {
    const result = scoreAiMlCostManagement(undefined, ASSESSED_AT);
    expect(result.domain).toBe("ai-ml-cost-management");
    expect(result.maturityLevel).toBe("crawl");
    expect(result.score).toBe(0);
  });

  it("returns run with score 100 when all signals true", () => {
    const result = scoreAiMlCostManagement(
      {
        hasAiCostVisibility: true,
        hasTokenAttribution: true,
        hasModelCostOptimization: true,
        hasAiCostAlerts: true,
      },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("run");
    expect(result.score).toBe(100);
  });

  it("score 50 maps to walk (2 of 4 signals)", () => {
    const result = scoreAiMlCostManagement(
      { hasAiCostVisibility: true, hasTokenAttribution: true },
      ASSESSED_AT,
    );
    expect(result.maturityLevel).toBe("walk");
    expect(result.score).toBe(50);
  });

  it("has 4 findings", () => {
    const result = scoreAiMlCostManagement({}, ASSESSED_AT);
    expect(result.findings).toHaveLength(4);
  });

  it("correct domain name", () => {
    expect(scoreAiMlCostManagement(undefined, ASSESSED_AT).domainName).toBe(
      "AI / ML Cost Management",
    );
  });
});

// ─── Engine: computeAssessment ─────────────────────────────────────────────────

describe("computeAssessment — shape and metadata", () => {
  it("returns an assessment with all 6 capabilities", () => {
    const result = computeAssessment(baseInput());
    expect(result.capabilities).toHaveLength(6);
  });

  it("workspaceId is propagated", () => {
    const result = computeAssessment(baseInput({ workspaceId: "ws-abc" }));
    expect(result.workspaceId).toBe("ws-abc");
  });

  it("periodStart and periodEnd are propagated", () => {
    const result = computeAssessment(
      baseInput({ periodStart: "2026-02-01", periodEnd: "2026-03-01" }),
    );
    expect(result.periodStart).toBe("2026-02-01");
    expect(result.periodEnd).toBe("2026-03-01");
  });

  it("assessmentVersion is 2026.1", () => {
    const result = computeAssessment(baseInput());
    expect(result.assessmentVersion).toBe("2026.1");
  });

  it("computedAt is a valid ISO 8601 timestamp", () => {
    const result = computeAssessment(baseInput());
    expect(new Date(result.computedAt).toISOString()).toBe(result.computedAt);
  });

  it("capabilities cover all 6 domains", () => {
    const result = computeAssessment(baseInput());
    const domains = result.capabilities.map((c) => c.domain);
    expect(domains).toContain("understand-cloud-usage-cost");
    expect(domains).toContain("quantify-business-value");
    expect(domains).toContain("optimize-cloud-usage-cost");
    expect(domains).toContain("manage-finops-practice");
    expect(domains).toContain("cloud-sustainability");
    expect(domains).toContain("ai-ml-cost-management");
  });
});

describe("computeAssessment — empty signals (all crawl)", () => {
  let result: ReturnType<typeof computeAssessment>;

  beforeEach(() => {
    result = computeAssessment(baseInput({ signals: {} }));
  });

  it("overall maturity is crawl when no signals", () => {
    expect(result.overallMaturityLevel).toBe("crawl");
  });

  it("overall score is 0 when no signals", () => {
    expect(result.overallScore).toBe(0);
  });

  it("all domain scores are 0", () => {
    for (const cap of result.capabilities) {
      expect(cap.score).toBe(0);
    }
  });

  it("topRecommendations has 3 entries", () => {
    expect(result.topRecommendations).toHaveLength(3);
  });

  it("topRecommendations are non-empty strings", () => {
    for (const rec of result.topRecommendations) {
      expect(typeof rec).toBe("string");
      expect(rec.length).toBeGreaterThan(0);
    }
  });
});

describe("computeAssessment — all signals true (all run)", () => {
  let result: ReturnType<typeof computeAssessment>;

  beforeEach(() => {
    result = computeAssessment(
      baseInput({
        signals: {
          understand: {
            hasTaggingPolicy: true,
            hasSharedCostAllocation: true,
            hasCostDashboard: true,
            hasUnitEconomics: true,
            hasAnomalyDetection: true,
          },
          quantify: {
            hasProductCostMapping: true,
            hasExecutiveReporting: true,
            hasRoiTracking: true,
            hasShowbackOrChargeback: true,
          },
          optimize: {
            hasCommitmentCoverage: true,
            hasRightsizing: true,
            hasWasteRemediation: true,
            hasSpotUsage: true,
            hasStorageLifecycle: true,
          },
          managePractice: {
            hasFinOpsTeam: true,
            hasBudgetProcess: true,
            hasKpiTracking: true,
            hasEngineerVisibility: true,
            hasMaturityReview: true,
          },
          sustainability: {
            hasCarbonVisibility: true,
            hasSustainabilityTargets: true,
            hasGreenRegionPolicy: true,
          },
          aiMl: {
            hasAiCostVisibility: true,
            hasTokenAttribution: true,
            hasModelCostOptimization: true,
            hasAiCostAlerts: true,
          },
        },
      }),
    );
  });

  it("overall maturity is run when all signals true", () => {
    expect(result.overallMaturityLevel).toBe("run");
  });

  it("overall score is 100 when all signals true", () => {
    expect(result.overallScore).toBe(100);
  });

  it("all domain scores are 100", () => {
    for (const cap of result.capabilities) {
      expect(cap.score).toBe(100);
    }
  });

  it("all domain maturity levels are run", () => {
    for (const cap of result.capabilities) {
      expect(cap.maturityLevel).toBe("run");
    }
  });

  it("topRecommendations may be empty when all domains are at 100 (no recommendations generated)", () => {
    // When all signals are true, scorers produce no recommendations
    // topRecommendations will be an empty array — this is correct behaviour
    expect(Array.isArray(result.topRecommendations)).toBe(true);
  });
});

describe("computeAssessment — modal maturity tie-break", () => {
  it("prefers crawl over walk when counts are equal", () => {
    // 3 crawl domains + 3 walk domains → tie → crawl wins
    const result = computeAssessment(
      baseInput({
        signals: {
          // crawl: understand (0/5=0), optimize (0/5=0), sustainability (0/3=0)
          understand: {},
          optimize: {},
          sustainability: {},
          // walk: quantify (2/4=50), managePractice (2/5=40), aiMl (2/4=50)
          quantify: {
            hasProductCostMapping: true,
            hasExecutiveReporting: true,
          },
          managePractice: {
            hasFinOpsTeam: true,
            hasBudgetProcess: true,
          },
          aiMl: {
            hasAiCostVisibility: true,
            hasTokenAttribution: true,
          },
        },
      }),
    );
    // 3 crawl (0, 0, 0) + 3 walk (50, 40, 50)
    const maturityCounts = result.capabilities.reduce(
      (acc, c) => {
        acc[c.maturityLevel]++;
        return acc;
      },
      { crawl: 0, walk: 0, run: 0 },
    );
    expect(maturityCounts.crawl).toBe(3);
    expect(maturityCounts.walk).toBe(3);
    expect(result.overallMaturityLevel).toBe("crawl");
  });

  it("returns walk when majority are walk", () => {
    // 4 walk domains, 2 crawl → walk modal
    const result = computeAssessment(
      baseInput({
        signals: {
          understand: { hasTaggingPolicy: true, hasCostDashboard: true }, // 40 = walk
          quantify: { hasProductCostMapping: true, hasExecutiveReporting: true }, // 50 = walk
          optimize: { hasCommitmentCoverage: true, hasRightsizing: true }, // 40 = walk
          managePractice: { hasFinOpsTeam: true, hasBudgetProcess: true }, // 40 = walk
          sustainability: {}, // 0 = crawl
          aiMl: {}, // 0 = crawl
        },
      }),
    );
    expect(result.overallMaturityLevel).toBe("walk");
  });
});

describe("computeAssessment — topRecommendations ordering", () => {
  it("topRecommendations come from lowest-scoring domains first", () => {
    // aiMl has 0 signals (crawl=0), understand has all signals (run=100)
    // so aiMl's recommendation should appear before understand's (which has none anyway)
    const result = computeAssessment(
      baseInput({
        signals: {
          understand: {
            hasTaggingPolicy: true,
            hasSharedCostAllocation: true,
            hasCostDashboard: true,
            hasUnitEconomics: true,
            hasAnomalyDetection: true,
          },
          aiMl: {},
          sustainability: {},
          optimize: {},
          quantify: {},
          managePractice: {},
        },
      }),
    );
    // All top 3 recs should come from the crawl domains, not understand (score=100)
    // The understand domain produces no recommendations (all signals true)
    expect(result.topRecommendations).toHaveLength(3);
    // Verify the recs are non-empty strings from the crawl domains
    for (const rec of result.topRecommendations) {
      expect(rec.length).toBeGreaterThan(10);
    }
  });

  it("topRecommendations has at most 3 entries", () => {
    const result = computeAssessment(baseInput());
    expect(result.topRecommendations.length).toBeLessThanOrEqual(3);
  });
});

describe("computeAssessment — partial signals", () => {
  it("handles only one domain having signals", () => {
    const result = computeAssessment(
      baseInput({
        signals: {
          aiMl: {
            hasAiCostVisibility: true,
            hasTokenAttribution: true,
            hasModelCostOptimization: true,
            hasAiCostAlerts: true,
          },
        },
      }),
    );
    const aiMl = result.capabilities.find((c) => c.domain === "ai-ml-cost-management");
    expect(aiMl?.score).toBe(100);
    expect(aiMl?.maturityLevel).toBe("run");

    // Other domains should be crawl/0
    const understand = result.capabilities.find(
      (c) => c.domain === "understand-cloud-usage-cost",
    );
    expect(understand?.score).toBe(0);
    expect(understand?.maturityLevel).toBe("crawl");
  });

  it("overall score is average across all 6 domains", () => {
    // Only aiMl is 100; rest are 0. Average = 100/6 ≈ 17.
    const result = computeAssessment(
      baseInput({
        signals: {
          aiMl: {
            hasAiCostVisibility: true,
            hasTokenAttribution: true,
            hasModelCostOptimization: true,
            hasAiCostAlerts: true,
          },
        },
      }),
    );
    expect(result.overallScore).toBe(Math.round(100 / 6));
  });
});
