// ─── FinOps Assessment Engine ─────────────────────────────────────────────────
//
// computeAssessment(input) → FinOpsFrameworkAssessment
//
// Orchestrates all six domain scorers, derives the overall maturity level
// (modal level with tie-break to lower), and selects the top 3 cross-domain
// recommendations ordered by domain score ascending (lowest-scoring domains
// surface their top recommendation first, maximising impact).

import type {
  FinOpsFrameworkAssessment,
  FinOpsCapabilityAssessment,
  FinOpsMaturityLevel,
} from "@ficecal/contracts";

import type { AssessmentSignals } from "./signals.js";
import {
  scoreUnderstandCloudUsageCost,
  scoreQuantifyBusinessValue,
  scoreOptimizeCloudUsageCost,
  scoreManageFinOpsPractice,
  scoreCloudSustainability,
  scoreAiMlCostManagement,
} from "./scorers.js";

// ─── Assessment input ──────────────────────────────────────────────────────────

export interface ComputeAssessmentInput {
  /** Workspace identifier. */
  workspaceId: string;

  /** ISO 8601 start of the period being assessed. */
  periodStart: string;

  /** ISO 8601 end of the period being assessed. */
  periodEnd: string;

  /** Capability signal flags for each domain. */
  signals: AssessmentSignals;
}

// ─── Modal maturity ───────────────────────────────────────────────────────────

/**
 * Derive the overall maturity level as the modal level across all domains.
 * Tie-break rule: if bimodal, return the lower (less mature) level.
 * Level order: crawl < walk < run.
 */
function modalMaturity(
  capabilities: FinOpsCapabilityAssessment[],
): FinOpsMaturityLevel {
  const counts: Record<FinOpsMaturityLevel, number> = {
    crawl: 0,
    walk: 0,
    run: 0,
  };

  for (const cap of capabilities) {
    counts[cap.maturityLevel]++;
  }

  const max = Math.max(counts.crawl, counts.walk, counts.run);

  // Lower levels win ties
  if (counts.crawl === max) return "crawl";
  if (counts.walk === max) return "walk";
  return "run";
}

// ─── Top recommendations ──────────────────────────────────────────────────────

/**
 * Select the top 3 cross-domain recommendations.
 * Domains are sorted by score ascending (lowest first) so the most impactful
 * improvements surface at the top.  Takes the first recommendation from each
 * domain in that order until 3 are collected.
 */
function topRecommendations(
  capabilities: FinOpsCapabilityAssessment[],
): string[] {
  const sorted = [...capabilities].sort((a, b) => a.score - b.score);

  const selected: string[] = [];
  for (const cap of sorted) {
    if (selected.length >= 3) break;
    const first = cap.recommendations[0];
    if (first !== undefined && first.length > 0) {
      selected.push(first);
    }
  }

  return selected;
}

// ─── Overall score ────────────────────────────────────────────────────────────

/**
 * Compute the overall score as the simple (unweighted) average of all domain
 * scores, rounded to the nearest integer.
 *
 * A weighted variant can be added in Phase 10 once business priorities are
 * configurable per workspace.
 */
function overallScore(capabilities: FinOpsCapabilityAssessment[]): number {
  if (capabilities.length === 0) return 0;
  const sum = capabilities.reduce((acc, c) => acc + c.score, 0);
  return Math.round(sum / capabilities.length);
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Compute a full FinOps Framework 2026 assessment for a workspace.
 *
 * @param input - Workspace metadata and capability signal flags.
 * @returns A complete FinOpsFrameworkAssessment with per-domain results,
 *          overall maturity level, overall score, and top 3 recommendations.
 */
export function computeAssessment(
  input: ComputeAssessmentInput,
): FinOpsFrameworkAssessment {
  const assessedAt = new Date().toISOString();

  const capabilities: FinOpsCapabilityAssessment[] = [
    scoreUnderstandCloudUsageCost(input.signals.understand, assessedAt),
    scoreQuantifyBusinessValue(input.signals.quantify, assessedAt),
    scoreOptimizeCloudUsageCost(input.signals.optimize, assessedAt),
    scoreManageFinOpsPractice(input.signals.managePractice, assessedAt),
    scoreCloudSustainability(input.signals.sustainability, assessedAt),
    scoreAiMlCostManagement(input.signals.aiMl, assessedAt),
  ];

  return {
    workspaceId: input.workspaceId,
    assessmentVersion: "2026.1",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    capabilities,
    overallMaturityLevel: modalMaturity(capabilities),
    overallScore: overallScore(capabilities),
    topRecommendations: topRecommendations(capabilities),
    computedAt: assessedAt,
  };
}
