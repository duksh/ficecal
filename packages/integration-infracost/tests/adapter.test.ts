// ─── integration-infracost: adapter tests ─────────────────────────────────────

import { describe, it, expect } from "vitest";
import { NORMALIZED_COST_RECORD_SCHEMA_VERSION } from "@ficecal/schemas/normalized-cost-record";
import {
  normalizeInfracostResource,
  normalizeInfracostOutput,
} from "../src/adapter.js";
import type {
  InfracostOutput,
  InfracostProject,
  InfracostResource,
} from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SAMPLE_RESOURCE_AWS: InfracostResource = {
  name: "aws_instance.web",
  resourceType: "aws_instance",
  tags: { environment: "production" },
  monthlyCost: "124.416000",
  hourlyCost: "0.172800",
  costComponents: [
    {
      name: "Instance usage (Linux/UNIX, on-demand, t3.large)",
      unit: "hours",
      monthlyQuantity: "730",
      price: "0.1728",
      monthlyCost: "124.416000",
    },
  ],
};

const SAMPLE_RESOURCE_GCP: InfracostResource = {
  name: "google_compute_instance.default",
  resourceType: "google_compute_instance",
  tags: {},
  monthlyCost: "48.550000",
  costComponents: [
    {
      name: "Instance usage (e2-medium)",
      unit: "hours",
      monthlyQuantity: "730",
      price: "0.0665",
      monthlyCost: "48.550000",
    },
  ],
};

const SAMPLE_RESOURCE_AZURE: InfracostResource = {
  name: "azurerm_virtual_machine.main",
  resourceType: "azurerm_virtual_machine",
  monthlyCost: "78.000000",
  costComponents: [
    {
      name: "Virtual machine (Standard_B2s)",
      unit: "hours",
      monthlyQuantity: "730",
      price: "0.1068",
      monthlyCost: "78.000000",
    },
  ],
};

const SAMPLE_RESOURCE_UNKNOWN: InfracostResource = {
  name: "custom_resource.example",
  resourceType: "custom_resource",
  monthlyCost: "5.000000",
  costComponents: [],
};

const SAMPLE_PROJECT: InfracostProject = {
  name: "my-infrastructure",
  metadata: { path: "/path/to/terraform" },
  breakdown: {
    resources: [SAMPLE_RESOURCE_AWS, SAMPLE_RESOURCE_GCP],
  },
};

const SAMPLE_INFRACOST: InfracostOutput = {
  version: "0.2",
  currency: "USD",
  projects: [SAMPLE_PROJECT],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeInfracostResource", () => {
  it("maps AWS resource type to provider 'aws'", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.provider).toBe("aws");
  });

  it("maps GCP resource type to provider 'gcp'", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_GCP,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.provider).toBe("gcp");
  });

  it("maps Azure resource type to provider 'azure'", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AZURE,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.provider).toBe("azure");
  });

  it("falls back to 'unknown' for unrecognised resource type prefixes", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_UNKNOWN,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.provider).toBe("unknown");
  });

  it("sets serviceName to resourceType", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.serviceName).toBe("aws_instance");
  });

  it("sets resourceId to resource.name (Terraform address)", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.resourceId).toBe("aws_instance.web");
  });

  it("sets billedCost from resource.monthlyCost as-is", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.billedCost).toBe("124.416000");
    expect(typeof result.billedCost).toBe("string");
  });

  it("sets billingCurrency from infracost.currency", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.billingCurrency).toBe("USD");
    expect(result.currency).toBe("USD");
  });

  it("passes tags through unchanged (non-empty)", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.tags).toEqual({ environment: "production" });
  });

  it("omits tags when empty object", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_GCP,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.tags).toBeUndefined();
  });

  it("schemaVersion matches NORMALIZED_COST_RECORD_SCHEMA_VERSION", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.schemaVersion).toBe(NORMALIZED_COST_RECORD_SCHEMA_VERSION);
  });

  it("dataFreshnessStatus is 'fresh'", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.dataFreshnessStatus).toBe("fresh");
  });

  it("dataSource defaults to 'live'", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.dataSource).toBe("live");
  });

  it("chargeDescription notes Infracost estimate context", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.chargeDescription).toContain("Infracost estimate");
    expect(result.chargeDescription).toContain("not actual billing data");
  });

  it("servicePeriodStart and servicePeriodEnd are set (forecasted)", () => {
    const result = normalizeInfracostResource(
      SAMPLE_RESOURCE_AWS,
      SAMPLE_PROJECT,
      SAMPLE_INFRACOST,
    );
    expect(result.servicePeriodStart).toBeDefined();
    expect(result.servicePeriodEnd).toBeDefined();
    // End should be after start
    expect(result.servicePeriodEnd! > result.servicePeriodStart!).toBe(true);
  });

  it("generates a unique recordId per call", () => {
    const r1 = normalizeInfracostResource(SAMPLE_RESOURCE_AWS, SAMPLE_PROJECT, SAMPLE_INFRACOST);
    const r2 = normalizeInfracostResource(SAMPLE_RESOURCE_AWS, SAMPLE_PROJECT, SAMPLE_INFRACOST);
    expect(r1.recordId).not.toBe(r2.recordId);
  });
});

describe("normalizeInfracostOutput", () => {
  it("flattens all projects and resources into a flat array", () => {
    const result = normalizeInfracostOutput(SAMPLE_INFRACOST);
    // SAMPLE_INFRACOST has 1 project with 2 resources
    expect(result).toHaveLength(2);
  });

  it("returns empty array for output with no projects", () => {
    const empty: InfracostOutput = { version: "0.2", currency: "USD", projects: [] };
    expect(normalizeInfracostOutput(empty)).toEqual([]);
  });

  it("handles multi-project output", () => {
    const multiProject: InfracostOutput = {
      version: "0.2",
      currency: "USD",
      projects: [
        {
          name: "project-a",
          metadata: { path: "/a" },
          breakdown: { resources: [SAMPLE_RESOURCE_AWS] },
        },
        {
          name: "project-b",
          metadata: { path: "/b" },
          breakdown: { resources: [SAMPLE_RESOURCE_GCP, SAMPLE_RESOURCE_AZURE] },
        },
      ],
    };
    const results = normalizeInfracostOutput(multiProject);
    expect(results).toHaveLength(3);
  });

  it("applies options to all resources", () => {
    const results = normalizeInfracostOutput(SAMPLE_INFRACOST, { dataSource: "fixture" });
    for (const r of results) {
      expect(r.dataSource).toBe("fixture");
    }
  });
});
