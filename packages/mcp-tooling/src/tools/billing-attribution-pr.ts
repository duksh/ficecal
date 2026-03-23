// ─── billing.attribution.pr — MCP tool ────────────────────────────────────────
//
// PR-level cost delta / shift-left FinOps — estimates the monthly cost impact
// of a pull request by analysing infrastructure changes against known cost
// drivers. Aligned with the FinOps Framework 2026 Engineering Accountability
// capability.
//
// Tool id:   billing.attribution.pr
// Namespace: billing
// Stability: experimental

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrCostDriverCategory =
  | "compute"
  | "storage"
  | "network"
  | "ai-tokens"
  | "database";

export interface PrCostDriver {
  category: PrCostDriverCategory;
  description: string;
  estimatedMonthlyCost: number;
  currency: string;
  changeType: "added" | "modified" | "removed";
}

export type PrRiskLevel = "low" | "medium" | "high" | "critical";

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingAttributionPrInput {
  prId: string;
  repository: string;
  provider?: string;
  baseRef?: string;
  headRef?: string;
  periodStart: string;
  periodEnd: string;
}

export interface BillingAttributionPrOutput {
  prId: string;
  repository: string;
  provider: string;
  baseRef: string;
  headRef: string;
  periodStart: string;
  periodEnd: string;
  deltaCost: number;
  deltaPercent: number | null;
  currency: string;
  costDrivers: PrCostDriver[];
  riskLevel: PrRiskLevel;
  recommendation: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Deterministic fixtures
// ---------------------------------------------------------------------------

interface PrFixture {
  deltaCost: number;
  currency: string;
  costDrivers: PrCostDriver[];
  baselineCost: number | null;
}

const PR_FIXTURES: Record<string, PrFixture> = {
  "123": {
    deltaCost: 340,
    currency: "USD",
    baselineCost: 4200,
    costDrivers: [
      {
        category: "compute",
        description: "Added 2 x p3.2xlarge GPU instances for model training workloads.",
        estimatedMonthlyCost: 280,
        currency: "USD",
        changeType: "added",
      },
      {
        category: "storage",
        description: "New S3 bucket for model checkpoints (est. 500 GB/month).",
        estimatedMonthlyCost: 60,
        currency: "USD",
        changeType: "added",
      },
    ],
  },
  "456": {
    deltaCost: 45,
    currency: "USD",
    baselineCost: 2100,
    costDrivers: [
      {
        category: "storage",
        description: "Increased EBS volume from 200 GB to 500 GB for data pipeline output.",
        estimatedMonthlyCost: 45,
        currency: "USD",
        changeType: "modified",
      },
    ],
  },
  "999": {
    deltaCost: -180,
    currency: "USD",
    baselineCost: 3600,
    costDrivers: [
      {
        category: "compute",
        description: "Downsized RDS instance from db.r6g.xlarge to db.r6g.large.",
        estimatedMonthlyCost: -120,
        currency: "USD",
        changeType: "modified",
      },
      {
        category: "network",
        description: "Removed redundant data transfer to cross-region replica.",
        estimatedMonthlyCost: -60,
        currency: "USD",
        changeType: "removed",
      },
    ],
  },
};

const GENERIC_FIXTURE: PrFixture = {
  deltaCost: 120,
  currency: "USD",
  baselineCost: null,
  costDrivers: [
    {
      category: "compute",
      description: "Compute resource changes detected in infrastructure configuration.",
      estimatedMonthlyCost: 120,
      currency: "USD",
      changeType: "added",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeRiskLevel(deltaCost: number): PrRiskLevel {
  const abs = Math.abs(deltaCost);
  if (abs > 1000) return "critical";
  if (abs > 500) return "high";
  if (abs > 100) return "medium";
  return "low";
}

function buildRecommendation(deltaCost: number, riskLevel: PrRiskLevel): string {
  if (deltaCost < 0) {
    return `This PR reduces estimated monthly spend by $${Math.abs(deltaCost).toFixed(2)}. Approve — cost savings confirmed.`;
  }
  switch (riskLevel) {
    case "critical":
      return `This PR adds >$1000/month to infrastructure costs. Mandatory FinOps review required before merge.`;
    case "high":
      return `This PR adds >$500/month. Request FinOps team review and confirm budget allocation before merge.`;
    case "medium":
      return `This PR adds $${deltaCost.toFixed(2)}/month. Verify budget availability and add cost tags to new resources.`;
    case "low":
      return `Low-impact cost change ($${deltaCost.toFixed(2)}/month). Ensure new resources are tagged correctly.`;
  }
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingAttributionPrTool: McpToolDescriptor<
  BillingAttributionPrInput,
  BillingAttributionPrOutput
> = {
  id: "billing.attribution.pr",
  name: "Billing Attribution — PR Cost Delta",
  description:
    "Estimates the monthly cost impact of a pull request by analysing infrastructure " +
    "changes against known cost drivers. Enables shift-left FinOps by surfacing cost " +
    "deltas before merge. Aligned with the FinOps Framework 2026 Engineering " +
    "Accountability capability.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["prId", "repository", "periodStart", "periodEnd"],
    properties: {
      prId: {
        type: "string",
        description: "PR number or identifier (e.g. '123').",
      },
      repository: {
        type: "string",
        description: "Repository in org/repo format (e.g. 'my-org/infra').",
      },
      provider: {
        type: "string",
        description: "Cloud provider context. Default: 'aws'.",
      },
      baseRef: {
        type: "string",
        description: "Base branch of the PR. Default: 'main'.",
      },
      headRef: {
        type: "string",
        description: "Head branch of the PR.",
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of reference billing period.",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of reference billing period.",
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingAttributionPrOutput>> => {
    const { input, context } = envelope;

    const provider = input.provider ?? "aws";
    const baseRef = input.baseRef ?? "main";
    const headRef = input.headRef ?? `pr-${input.prId}`;

    // ── Look up fixture ────────────────────────────────────────────────────
    const fixture = PR_FIXTURES[input.prId] ?? GENERIC_FIXTURE;

    const deltaCost = fixture.deltaCost;
    const deltaPercent =
      fixture.baselineCost !== null
        ? parseFloat(((deltaCost / fixture.baselineCost) * 100).toFixed(2))
        : null;

    const riskLevel = computeRiskLevel(deltaCost);
    const recommendation = buildRecommendation(deltaCost, riskLevel);

    const warnings: string[] = [
      "PR cost attribution is deterministic (fixture-based). Live IaC diff analysis available in a future release.",
    ];

    const output: BillingAttributionPrOutput = {
      prId: input.prId,
      repository: input.repository,
      provider,
      baseRef,
      headRef,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      deltaCost,
      deltaPercent,
      currency: fixture.currency,
      costDrivers: fixture.costDrivers,
      riskLevel,
      recommendation,
      warnings,
    };

    return {
      output,
      toolId: billingAttributionPrTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.attribution.pr.shift-left",
        "billing.attribution.pr.deterministic",
      ],
    };
  },
};
