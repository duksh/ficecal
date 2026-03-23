// ─── billing.tag.governance — MCP tool ────────────────────────────────────────
//
// Tag governance / tag policy enforcement — identifies resources missing required
// tags and computes overall tagging compliance. Aligned with the FinOps Framework
// 2026 Tagging/Labeling capability.
//
// Tool id:   billing.tag.governance
// Namespace: billing
// Stability: beta

import type { McpToolDescriptor, McpToolResult } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViolationSeverity = "critical" | "high" | "medium";

export interface TagViolation {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  service: string;
  missingTags: string[];
  presentTags: Record<string, string>;
  monthlyCost: number;
  currency: string;
  severity: ViolationSeverity;
}

export interface TagGovernanceSummary {
  compliantCount: number;
  nonCompliantCount: number;
  compliancePercent: number;
  missingTagCounts: Record<string, number>;
  estimatedUntaggedCost: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface BillingTagGovernanceInput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  requiredTags?: string[];
  minCompliancePercent?: number;
}

export interface BillingTagGovernanceOutput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  overallCompliancePercent: number;
  totalResources: number;
  compliantResources: number;
  nonCompliantResources: number;
  violations: TagViolation[];
  summary: TagGovernanceSummary;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface ResourceFixture {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  service: string;
  presentTags: Record<string, string>;
  monthlyCost: number;
}

interface ProviderFixtures {
  currency: string;
  resources: ResourceFixture[];
}

const FIXTURES: Record<string, ProviderFixtures> = {
  aws: {
    currency: "USD",
    resources: [
      {
        resourceId: "i-0a1b2c3d4e5f6a7b8",
        resourceName: "web-server-prod-01",
        resourceType: "EC2 Instance",
        service: "Amazon EC2",
        presentTags: { env: "prod", team: "platform", project: "web-app" },
        monthlyCost: 182.40,
      },
      {
        resourceId: "i-0b2c3d4e5f6a7b8c9",
        resourceName: "worker-node-ml-01",
        resourceType: "EC2 Instance",
        service: "Amazon EC2",
        presentTags: { env: "prod", team: "ml" },
        monthlyCost: 540.00,
      },
      {
        resourceId: "db-0c3d4e5f6a7b8c9d0",
        resourceName: "analytics-rds-prod",
        resourceType: "RDS Instance",
        service: "Amazon RDS",
        presentTags: { env: "prod" },
        monthlyCost: 175.20,
      },
      {
        resourceId: "i-0d4e5f6a7b8c9d0e1",
        resourceName: "batch-runner-data-01",
        resourceType: "EC2 Instance",
        service: "Amazon EC2",
        presentTags: { team: "data", project: "etl-pipeline" },
        monthlyCost: 91.20,
      },
      {
        resourceId: "cache-0e5f6a7b8c9d0e1f2",
        resourceName: "session-cache-prod",
        resourceType: "ElastiCache Cluster",
        service: "Amazon ElastiCache",
        presentTags: {},
        monthlyCost: 121.32,
      },
      {
        resourceId: "i-0f6a7b8c9d0e1f2a3",
        resourceName: "api-gateway-svc-01",
        resourceType: "EC2 Instance",
        service: "Amazon EC2",
        presentTags: { env: "prod", team: "backend", project: "api-gateway" },
        monthlyCost: 182.40,
      },
      {
        resourceId: "lb-0a7b8c9d0e1f2a3b4",
        resourceName: "internal-alb-prod",
        resourceType: "Application Load Balancer",
        service: "Elastic Load Balancing",
        presentTags: { env: "prod", project: "network" },
        monthlyCost: 22.40,
      },
      {
        resourceId: "i-0b8c9d0e1f2a3b4c5",
        resourceName: "monitoring-agent-01",
        resourceType: "EC2 Instance",
        service: "Amazon EC2",
        presentTags: { env: "prod", team: "ops", project: "monitoring" },
        monthlyCost: 46.08,
      },
      {
        resourceId: "lambda-0c9d0e1f2a3b4c5d6",
        resourceName: "data-processor-fn",
        resourceType: "Lambda Function",
        service: "AWS Lambda",
        presentTags: { team: "data" },
        monthlyCost: 38.00,
      },
    ],
  },
  gcp: {
    currency: "USD",
    resources: [
      {
        resourceId: "projects/my-project/zones/us-central1-a/instances/app-server-01",
        resourceName: "app-server-01",
        resourceType: "Compute Engine VM",
        service: "Compute Engine",
        presentTags: { env: "prod", team: "engineering", project: "search" },
        monthlyCost: 210.50,
      },
      {
        resourceId: "projects/my-project/zones/us-central1-b/instances/vm-1",
        resourceName: "vm-1",
        resourceType: "Compute Engine VM",
        service: "Compute Engine",
        presentTags: { env: "prod" },
        monthlyCost: 145.20,
      },
      {
        resourceId: "projects/my-project/instances/gke-pool-ads",
        resourceName: "gke-pool-ads",
        resourceType: "GKE Node Pool",
        service: "Google Kubernetes Engine",
        presentTags: { team: "ads-eng", project: "ads" },
        monthlyCost: 820.00,
      },
      {
        resourceId: "projects/my-project/instances/cloudsql-analytics",
        resourceName: "cloudsql-analytics",
        resourceType: "Cloud SQL Instance",
        service: "Cloud SQL",
        presentTags: {},
        monthlyCost: 288.00,
      },
      {
        resourceId: "projects/my-project/bigquery/datasets/events_dataset",
        resourceName: "events_dataset",
        resourceType: "BigQuery Dataset",
        service: "BigQuery",
        presentTags: { env: "prod", team: "data", project: "analytics" },
        monthlyCost: 640.00,
      },
      {
        resourceId: "projects/my-project/storage/ml-artifacts-bucket",
        resourceName: "ml-artifacts-bucket",
        resourceType: "Cloud Storage Bucket",
        service: "Cloud Storage",
        presentTags: { team: "ml" },
        monthlyCost: 42.80,
      },
      {
        resourceId: "projects/my-project/zones/us-central1-c/instances/worker-02",
        resourceName: "worker-02",
        resourceType: "Compute Engine VM",
        service: "Compute Engine",
        presentTags: { env: "staging", team: "search", project: "search" },
        monthlyCost: 95.40,
      },
      {
        resourceId: "projects/my-project/functions/event-processor",
        resourceName: "event-processor",
        resourceType: "Cloud Function",
        service: "Cloud Functions",
        presentTags: { env: "prod", team: "data", project: "events" },
        monthlyCost: 18.60,
      },
      {
        resourceId: "projects/my-project/pubsub/topics/raw-events",
        resourceName: "raw-events",
        resourceType: "Pub/Sub Topic",
        service: "Cloud Pub/Sub",
        presentTags: { project: "events" },
        monthlyCost: 55.00,
      },
    ],
  },
  azure: {
    currency: "USD",
    resources: [
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-prod-01",
        resourceName: "vm-prod-01",
        resourceType: "Virtual Machine",
        service: "Azure Virtual Machines",
        presentTags: { env: "prod", team: "dev", project: "web-portal" },
        monthlyCost: 192.00,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-prod/providers/Microsoft.Sql/servers/sqlsrv-prod/databases/appdb",
        resourceName: "appdb",
        resourceType: "SQL Database",
        service: "Azure SQL Database",
        presentTags: { env: "prod" },
        monthlyCost: 364.80,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-prod/providers/Microsoft.ContainerService/managedClusters/aks-prod",
        resourceName: "aks-prod",
        resourceType: "AKS Cluster",
        service: "Azure Kubernetes Service",
        presentTags: {},
        monthlyCost: 540.00,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-qa/providers/Microsoft.Compute/virtualMachines/vm-qa-01",
        resourceName: "vm-qa-01",
        resourceType: "Virtual Machine",
        service: "Azure Virtual Machines",
        presentTags: { env: "staging", team: "qa", project: "qa-automation" },
        monthlyCost: 96.00,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-prod/providers/Microsoft.Storage/storageAccounts/stprodlogs",
        resourceName: "stprodlogs",
        resourceType: "Storage Account",
        service: "Azure Blob Storage",
        presentTags: { env: "prod", team: "ops" },
        monthlyCost: 35.40,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-prod/providers/Microsoft.Cache/Redis/cache-prod-01",
        resourceName: "cache-prod-01",
        resourceType: "Redis Cache",
        service: "Azure Cache for Redis",
        presentTags: { team: "backend", project: "api" },
        monthlyCost: 82.48,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-ml/providers/Microsoft.MachineLearningServices/workspaces/mlws-prod",
        resourceName: "mlws-prod",
        resourceType: "Machine Learning Workspace",
        service: "Azure Machine Learning",
        presentTags: { env: "prod", team: "ml", project: "model-training" },
        monthlyCost: 415.20,
      },
      {
        resourceId: "/subscriptions/sub-001/resourceGroups/rg-shared/providers/Microsoft.Network/applicationGateways/agw-prod",
        resourceName: "agw-prod",
        resourceType: "Application Gateway",
        service: "Azure Application Gateway",
        presentTags: { env: "prod" },
        monthlyCost: 48.00,
      },
    ],
  },
};

const SUPPORTED_PROVIDERS = Object.keys(FIXTURES);
const DEFAULT_REQUIRED_TAGS = ["env", "team", "project"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeSeverity(missingTags: string[], requiredTags: string[]): ViolationSeverity {
  const missingCount = missingTags.length;
  if (missingCount === requiredTags.length) return "critical";
  if (missingCount / requiredTags.length > 0.5) return "high";
  return "medium";
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export const billingTagGovernanceTool: McpToolDescriptor<
  BillingTagGovernanceInput,
  BillingTagGovernanceOutput
> = {
  id: "billing.tag.governance",
  name: "Billing Tag Governance",
  description:
    "Identifies resources missing required tags and computes overall tagging compliance. " +
    "Surfaces violations with severity levels and estimated untagged spend. " +
    "Aligned with the FinOps Framework 2026 Tagging/Labeling capability.",
  namespace: "billing",
  stability: "beta",

  inputSchema: {
    type: "object" as const,
    required: ["provider", "periodStart", "periodEnd"],
    properties: {
      provider: {
        type: "string",
        description: `Cloud provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
        enum: SUPPORTED_PROVIDERS,
      },
      periodStart: {
        type: "string",
        description: "ISO 8601 date — start of billing period.",
      },
      periodEnd: {
        type: "string",
        description: "ISO 8601 date — end of billing period.",
      },
      requiredTags: {
        type: "array",
        description: "Required tag keys. Default: [\"env\", \"team\", \"project\"].",
        items: { type: "string" },
      },
      minCompliancePercent: {
        type: "number",
        description: "Minimum compliance percent threshold. Default: 80.",
      },
    },
  },

  handler: async (envelope): Promise<McpToolResult<BillingTagGovernanceOutput>> => {
    const { input, context } = envelope;

    const fixture = FIXTURES[input.provider];
    if (!fixture) {
      throw Object.assign(
        new Error(
          `Provider '${input.provider}' is not supported. ` +
          `Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`,
        ),
        { code: "UNKNOWN_PROVIDER" },
      );
    }

    const requiredTags = input.requiredTags ?? DEFAULT_REQUIRED_TAGS;
    const minCompliancePercent = input.minCompliancePercent ?? 80;

    // ── Compute violations ─────────────────────────────────────────────────
    const violations: TagViolation[] = [];
    let compliantCount = 0;

    for (const resource of fixture.resources) {
      const missingTags = requiredTags.filter(
        (tag) => !Object.prototype.hasOwnProperty.call(resource.presentTags, tag),
      );

      if (missingTags.length === 0) {
        compliantCount++;
      } else {
        violations.push({
          resourceId: resource.resourceId,
          resourceName: resource.resourceName,
          resourceType: resource.resourceType,
          service: resource.service,
          missingTags,
          presentTags: resource.presentTags,
          monthlyCost: resource.monthlyCost,
          currency: fixture.currency,
          severity: computeSeverity(missingTags, requiredTags),
        });
      }
    }

    const totalResources = fixture.resources.length;
    const nonCompliantCount = violations.length;
    const compliancePercent = parseFloat(
      ((compliantCount / totalResources) * 100).toFixed(2),
    );

    // ── Missing tag counts ─────────────────────────────────────────────────
    const missingTagCounts: Record<string, number> = {};
    for (const tag of requiredTags) {
      missingTagCounts[tag] = 0;
    }
    for (const v of violations) {
      for (const tag of v.missingTags) {
        missingTagCounts[tag] = (missingTagCounts[tag] ?? 0) + 1;
      }
    }

    const estimatedUntaggedCost = violations.reduce((s, v) => s + v.monthlyCost, 0);

    const summary: TagGovernanceSummary = {
      compliantCount,
      nonCompliantCount,
      compliancePercent,
      missingTagCounts,
      estimatedUntaggedCost: parseFloat(estimatedUntaggedCost.toFixed(2)),
      currency: fixture.currency,
    };

    const warnings: string[] = [
      "Tag governance data is deterministic (fixture-based). Live resource scanning available in a future release.",
    ];

    if (compliancePercent < minCompliancePercent) {
      warnings.push(
        `Compliance ${compliancePercent}% is below the required threshold of ${minCompliancePercent}%.`,
      );
    }

    const output: BillingTagGovernanceOutput = {
      provider: input.provider,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      overallCompliancePercent: compliancePercent,
      totalResources,
      compliantResources: compliantCount,
      nonCompliantResources: nonCompliantCount,
      violations,
      summary,
      warnings,
    };

    return {
      output,
      toolId: billingTagGovernanceTool.id,
      executedAt: new Date().toISOString(),
      requestId: context.requestId,
      warnings,
      appliedIds: [
        "billing.tag.governance.focus-aligned",
        "billing.tag.governance.deterministic",
      ],
    };
  },
};
