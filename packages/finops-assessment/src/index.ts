// ─── @ficecal/finops-assessment — public API ──────────────────────────────────

// Input signals
export type {
  AssessmentSignals,
  UnderstandSignals,
  QuantifySignals,
  OptimizeSignals,
  ManagePracticeSignals,
  SustainabilitySignals,
  AiMlSignals,
} from "./signals.js";

// Engine
export type { ComputeAssessmentInput } from "./engine.js";
export { computeAssessment } from "./engine.js";

// Individual domain scorers (exported for testing and composability)
export {
  scoreUnderstandCloudUsageCost,
  scoreQuantifyBusinessValue,
  scoreOptimizeCloudUsageCost,
  scoreManageFinOpsPractice,
  scoreCloudSustainability,
  scoreAiMlCostManagement,
} from "./scorers.js";
