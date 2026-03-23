// ─── Per-domain scoring functions ─────────────────────────────────────────────
//
// Each scorer:
//   1. Counts how many signals are true (present and active)
//   2. Converts the ratio to a 0–100 score
//   3. Derives the maturity level: 0–33 → crawl, 34–66 → walk, 67–100 → run
//   4. Returns findings (what is present/absent) and recommendations (next steps)
//   5. Returns a FinOpsCapabilityAssessment for its domain
//
// Score bands:
//   0–33   → crawl  (ad hoc, reactive)
//   34–66  → walk   (repeatable, dashboards in place)
//   67–100 → run    (proactive, automated, benchmarked)

import type {
  FinOpsCapabilityAssessment,
  FinOpsMaturityLevel,
} from "@ficecal/contracts";

import type {
  UnderstandSignals,
  QuantifySignals,
  OptimizeSignals,
  ManagePracticeSignals,
  SustainabilitySignals,
  AiMlSignals,
} from "./signals.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert a 0–1 ratio to a 0–100 score.
 * Uses a simple linear mapping but floors to 0 to avoid negative from rounding.
 */
function ratioToScore(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

/** Map a 0–100 score to a maturity level. */
function scoreToMaturity(score: number): FinOpsMaturityLevel {
  if (score <= 33) return "crawl";
  if (score <= 66) return "walk";
  return "run";
}

/** Shorthand to build a FinOpsCapabilityAssessment. */
function build(
  domain: FinOpsCapabilityAssessment["domain"],
  domainName: string,
  score: number,
  findings: string[],
  recommendations: string[],
  assessedAt: string,
): FinOpsCapabilityAssessment {
  return {
    domain,
    domainName,
    maturityLevel: scoreToMaturity(score),
    score,
    findings,
    recommendations,
    assessedAt,
  };
}

// ─── Domain scorers ───────────────────────────────────────────────────────────

export function scoreUnderstandCloudUsageCost(
  signals: UnderstandSignals | undefined,
  assessedAt: string,
): FinOpsCapabilityAssessment {
  const s = signals ?? {};

  const flags = [
    s.hasTaggingPolicy,
    s.hasSharedCostAllocation,
    s.hasCostDashboard,
    s.hasUnitEconomics,
    s.hasAnomalyDetection,
  ] as const;

  const present = flags.filter(Boolean).length;
  const score = ratioToScore(present, flags.length);

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (s.hasTaggingPolicy) {
    findings.push("Tagging policy is defined and enforced across resources.");
  } else {
    findings.push("No tagging policy detected; cost allocation by team is unreliable.");
    recommendations.push("Define and enforce a mandatory tagging policy covering team, env, and product tags.");
  }

  if (s.hasSharedCostAllocation) {
    findings.push("Shared costs (support, EDPs) are allocated across consuming teams.");
  } else {
    findings.push("Shared costs are pooled at the account level and not distributed.");
    recommendations.push("Implement proportional or tag-based shared cost allocation for support and enterprise discounts.");
  }

  if (s.hasCostDashboard) {
    findings.push("A cost dashboard is available and reviewed at least monthly.");
  } else {
    findings.push("No dedicated cost dashboard is in regular use.");
    recommendations.push("Stand up a cloud cost dashboard (e.g. AWS Cost Explorer, Looker) reviewed in monthly review cycles.");
  }

  if (s.hasUnitEconomics) {
    findings.push("Unit economics metrics (cost-per-request, cost-per-user) are tracked.");
  } else {
    findings.push("Unit economics are not tracked; cost efficiency trends are invisible.");
    recommendations.push("Instrument and publish cost-per-unit metrics alongside product KPIs.");
  }

  if (s.hasAnomalyDetection) {
    findings.push("Anomaly detection alerts are active for unexpected cost spikes.");
  } else {
    findings.push("No automated anomaly detection; cost overruns are discovered reactively.");
    recommendations.push("Enable automated cost anomaly detection with alert thresholds per service.");
  }

  return build(
    "understand-cloud-usage-cost",
    "Understand Cloud Usage & Cost",
    score,
    findings,
    recommendations,
    assessedAt,
  );
}

export function scoreQuantifyBusinessValue(
  signals: QuantifySignals | undefined,
  assessedAt: string,
): FinOpsCapabilityAssessment {
  const s = signals ?? {};

  const flags = [
    s.hasProductCostMapping,
    s.hasExecutiveReporting,
    s.hasRoiTracking,
    s.hasShowbackOrChargeback,
  ] as const;

  const present = flags.filter(Boolean).length;
  const score = ratioToScore(present, flags.length);

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (s.hasProductCostMapping) {
    findings.push("Cloud spend is mapped to product lines or revenue streams.");
  } else {
    findings.push("Cloud spend cannot be attributed to specific business products.");
    recommendations.push("Map cloud resource spend to product lines to enable unit economics and P&L attribution.");
  }

  if (s.hasExecutiveReporting) {
    findings.push("Unit cost trends are reported to leadership at least quarterly.");
  } else {
    findings.push("No regular executive-level cost reporting is in place.");
    recommendations.push("Create a quarterly FinOps executive report covering spend trends, efficiency KPIs, and forecasts.");
  }

  if (s.hasRoiTracking) {
    findings.push("ROI and payback periods are tracked for major cloud investments.");
  } else {
    findings.push("Cloud investment ROI is not formally tracked.");
    recommendations.push("Define ROI criteria before major cloud investments and measure actuals at 3, 6, and 12 months.");
  }

  if (s.hasShowbackOrChargeback) {
    findings.push("Showback or chargeback is in place for internal cost accountability.");
  } else {
    findings.push("No showback or chargeback mechanism; teams lack cost accountability.");
    recommendations.push("Implement showback reports for teams, with a roadmap to full chargeback.");
  }

  return build(
    "quantify-business-value",
    "Quantify Business Value",
    score,
    findings,
    recommendations,
    assessedAt,
  );
}

export function scoreOptimizeCloudUsageCost(
  signals: OptimizeSignals | undefined,
  assessedAt: string,
): FinOpsCapabilityAssessment {
  const s = signals ?? {};

  const flags = [
    s.hasCommitmentCoverage,
    s.hasRightsizing,
    s.hasWasteRemediation,
    s.hasSpotUsage,
    s.hasStorageLifecycle,
  ] as const;

  const present = flags.filter(Boolean).length;
  const score = ratioToScore(present, flags.length);

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (s.hasCommitmentCoverage) {
    findings.push("Reserved instances / savings plans / CUDs are purchased and actively managed.");
  } else {
    findings.push("No commitment-based discounts in use; all compute billed on-demand.");
    recommendations.push("Analyse baseline compute spend and purchase 1-year savings plans for stable workloads (target ≥60% coverage).");
  }

  if (s.hasRightsizing) {
    findings.push("Rightsizing recommendations are reviewed and actioned monthly.");
  } else {
    findings.push("No rightsizing process; over-provisioned resources accumulate unchecked.");
    recommendations.push("Enable rightsizing recommendations in your cloud console and incorporate them into monthly engineering reviews.");
  }

  if (s.hasWasteRemediation) {
    findings.push("Idle and unattached resources are identified and cleaned up regularly.");
  } else {
    findings.push("Waste remediation is not formalised; idle resources accumulate over time.");
    recommendations.push("Schedule a monthly waste sweep for unattached volumes, unused IPs, and zombie instances.");
  }

  if (s.hasSpotUsage) {
    findings.push("Spot / preemptible instances are used for fault-tolerant workloads.");
  } else {
    findings.push("Spot or preemptible instances are not in use; savings opportunity unrealised.");
    recommendations.push("Identify batch and stateless workloads that can safely run on spot instances (typical saving: 60–80%).");
  }

  if (s.hasStorageLifecycle) {
    findings.push("Storage lifecycle policies are defined for tiering and expiry.");
  } else {
    findings.push("No storage lifecycle policies; data accumulates in expensive tiers indefinitely.");
    recommendations.push("Define S3/GCS/Blob lifecycle policies to transition infrequent data to cheaper tiers after 30–90 days.");
  }

  return build(
    "optimize-cloud-usage-cost",
    "Optimize Cloud Usage & Cost",
    score,
    findings,
    recommendations,
    assessedAt,
  );
}

export function scoreManageFinOpsPractice(
  signals: ManagePracticeSignals | undefined,
  assessedAt: string,
): FinOpsCapabilityAssessment {
  const s = signals ?? {};

  const flags = [
    s.hasFinOpsTeam,
    s.hasBudgetProcess,
    s.hasKpiTracking,
    s.hasEngineerVisibility,
    s.hasMaturityReview,
  ] as const;

  const present = flags.filter(Boolean).length;
  const score = ratioToScore(present, flags.length);

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (s.hasFinOpsTeam) {
    findings.push("A FinOps team or virtual FinOps function is established.");
  } else {
    findings.push("No dedicated FinOps function; cost management is reactive and ad hoc.");
    recommendations.push("Form a virtual FinOps team with representatives from Finance, Engineering, and Product.");
  }

  if (s.hasBudgetProcess) {
    findings.push("Cloud cost budgets are set and reviewed against actuals monthly.");
  } else {
    findings.push("No formal budget process for cloud spend.");
    recommendations.push("Establish monthly cloud budgets per team and track variance against actuals in reviews.");
  }

  if (s.hasKpiTracking) {
    findings.push("FinOps KPIs (utilisation rate, waste %, coverage %) are tracked.");
  } else {
    findings.push("No FinOps KPIs in regular use; maturity progress is unmeasured.");
    recommendations.push("Define 3–5 FinOps KPIs (e.g. commitment utilisation, tagging coverage, waste %) and publish monthly.");
  }

  if (s.hasEngineerVisibility) {
    findings.push("Engineering teams have self-serve visibility into their cloud costs.");
  } else {
    findings.push("Engineers cannot see cost impact of their services without requesting data.");
    recommendations.push("Provide per-service cost dashboards accessible to engineering teams directly.");
  }

  if (s.hasMaturityReview) {
    findings.push("A FinOps maturity review is conducted at least annually.");
  } else {
    findings.push("No formal maturity review cadence; practice drift goes undetected.");
    recommendations.push("Schedule an annual FinOps maturity review against the FinOps Framework 2026 capability model.");
  }

  return build(
    "manage-finops-practice",
    "Manage the FinOps Practice",
    score,
    findings,
    recommendations,
    assessedAt,
  );
}

export function scoreCloudSustainability(
  signals: SustainabilitySignals | undefined,
  assessedAt: string,
): FinOpsCapabilityAssessment {
  const s = signals ?? {};

  const flags = [
    s.hasCarbonVisibility,
    s.hasSustainabilityTargets,
    s.hasGreenRegionPolicy,
  ] as const;

  const present = flags.filter(Boolean).length;
  const score = ratioToScore(present, flags.length);

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (s.hasCarbonVisibility) {
    findings.push("Carbon emissions data is available per workload or cloud service.");
  } else {
    findings.push("No carbon emissions data is tracked for cloud workloads.");
    recommendations.push("Enable cloud provider carbon footprint reporting (e.g. AWS CCT, Google Carbon Footprint) and review monthly.");
  }

  if (s.hasSustainabilityTargets) {
    findings.push("Sustainability targets or SLOs are defined for cloud workloads.");
  } else {
    findings.push("No sustainability targets are set for cloud infrastructure.");
    recommendations.push("Set a carbon intensity reduction target (e.g. 10% year-over-year) tied to cloud spend growth.");
  }

  if (s.hasGreenRegionPolicy) {
    findings.push("Region selection considers carbon intensity as a factor.");
  } else {
    findings.push("Region selection is driven only by latency/compliance; carbon intensity is not considered.");
    recommendations.push("Add carbon intensity as a weighted criterion in region selection decisions for non-latency-sensitive workloads.");
  }

  return build(
    "cloud-sustainability",
    "Cloud Sustainability",
    score,
    findings,
    recommendations,
    assessedAt,
  );
}

export function scoreAiMlCostManagement(
  signals: AiMlSignals | undefined,
  assessedAt: string,
): FinOpsCapabilityAssessment {
  const s = signals ?? {};

  const flags = [
    s.hasAiCostVisibility,
    s.hasTokenAttribution,
    s.hasModelCostOptimization,
    s.hasAiCostAlerts,
  ] as const;

  const present = flags.filter(Boolean).length;
  const score = ratioToScore(present, flags.length);

  const findings: string[] = [];
  const recommendations: string[] = [];

  if (s.hasAiCostVisibility) {
    findings.push("AI/ML inference costs are tracked at the model or endpoint level.");
  } else {
    findings.push("AI/ML inference costs are not tracked at the model level; visibility is absent.");
    recommendations.push("Instrument AI/ML endpoints with per-request cost tracking and attribute to consuming services.");
  }

  if (s.hasTokenAttribution) {
    findings.push("Token usage and per-request cost are attributed to consuming teams.");
  } else {
    findings.push("Token usage is not attributed to teams; AI cost accountability is absent.");
    recommendations.push("Implement token-level cost attribution using request tagging or API gateway metadata.");
  }

  if (s.hasModelCostOptimization) {
    findings.push("Model selection considers cost-per-quality trade-offs explicitly.");
  } else {
    findings.push("Model selection is not evaluated on cost-per-quality trade-offs.");
    recommendations.push("Build a model evaluation framework that scores models on cost-per-output-quality and favours smaller models where accuracy loss is acceptable.");
  }

  if (s.hasAiCostAlerts) {
    findings.push("AI/ML cost budgets and usage alerts are active.");
  } else {
    findings.push("No AI/ML cost budgets or alerts in place; runaway inference spend is a risk.");
    recommendations.push("Set per-model and per-team monthly AI spend budgets with automated alerts at 80% and 100% of threshold.");
  }

  return build(
    "ai-ml-cost-management",
    "AI / ML Cost Management",
    score,
    findings,
    recommendations,
    assessedAt,
  );
}
