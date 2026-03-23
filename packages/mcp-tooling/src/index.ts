export type {
  McpMode,
  McpActor,
  McpTimeRange,
  McpContractVersions,
  McpRequestContext,
  McpToolEnvelope,
  McpToolInputSchema,
  McpToolDescriptor,
  McpToolResult,
  McpToolNamespaceManifest,
  McpCapabilitiesManifest,
} from "./types.js";

export { McpToolRegistry } from "./tool-registry.js";

export { costEstimateTool } from "./tools/cost-estimate.js";
export { healthScoreQueryTool } from "./tools/health-score-query.js";
export { periodNormalizeTool } from "./tools/period-normalize.js";

// ─── Billing tools ─────────────────────────────────────────────────────────────
export type {
  BillingEstimateActualInput,
  BillingEstimateActualOutput,
  BillingAdapterRegistry,
} from "./tools/billing-estimate-actual.js";
export {
  billingEstimateActualTool,
  setBillingRegistry as setEstimateBillingRegistry,
  _resetBillingRegistry as _resetEstimateBillingRegistry,
} from "./tools/billing-estimate-actual.js";

export type {
  BillingComparePeriodInput,
  BillingComparePeriodOutput,
  ServiceDelta,
} from "./tools/billing-compare-period.js";
export {
  billingComparePeriodTool,
  setBillingRegistry as setCompareBillingRegistry,
  _resetBillingRegistry as _resetCompareBillingRegistry,
} from "./tools/billing-compare-period.js";

export type {
  CommitmentDiscountCategory,
  CommitmentDiscountStatus,
  CommitmentStatusRecord,
  CommitmentSummary,
  BillingCommitmentStatusInput,
  BillingCommitmentStatusOutput,
  CommitmentAdapterRegistry,
} from "./tools/billing-commitment-status.js";
export {
  billingCommitmentStatusTool,
  setCommitmentBillingRegistry,
  _resetCommitmentBillingRegistry,
} from "./tools/billing-commitment-status.js";

// ─── Chargeback / Allocation tool ──────────────────────────────────────────────
export type {
  AllocationMethodId,
  AllocationRecord,
  AllocationSummary,
  BillingChargebackAllocateInput,
  BillingChargebackAllocateOutput,
  ChargebackAdapterRegistry,
} from "./tools/billing-chargeback-allocate.js";
export {
  billingChargebackAllocateTool,
  setChargebackBillingRegistry,
  _resetChargebackBillingRegistry,
} from "./tools/billing-chargeback-allocate.js";

// ─── FinOps Assessment tool ─────────────────────────────────────────────────────
export type {
  FinOpsAssessmentRunInput,
  FinOpsAssessmentRunOutput,
} from "./tools/finops-assessment-run.js";
export { finOpsAssessmentRunTool } from "./tools/finops-assessment-run.js";

// ─── FinOps Assessment Correlate tool (Phase 10A P3) ─────────────────────────
export type {
  FinOpsAssessmentCorrelateInput,
  CorrelatedRecommendation,
  ImplementationEffort,
  FinOpsAssessmentCorrelateOutput,
  CorrelationBillingRegistry,
} from "./tools/finops-assessment-correlate.js";
export {
  finOpsAssessmentCorrelateTool,
  setCorrelationBillingRegistry,
  _resetCorrelationBillingRegistry,
} from "./tools/finops-assessment-correlate.js";

// ─── Billing Routing Optimize tool (Phase 10A P4) ────────────────────────────
export type {
  BillingRoutingOptimizeInput,
  BillingRoutingOptimizeOutput,
  RoutingOpportunity,
  ModelAlternative,
  ModelTier,
  RoutingBillingRegistry,
} from "./tools/billing-routing-optimize.js";
export {
  billingRoutingOptimizeTool,
  setRoutingBillingRegistry,
  _resetRoutingBillingRegistry,
  // Live pricing oracle — catalog setters
  setRoutingCatalog,
  _resetRoutingCatalog,
  buildRoutingCatalogFromPricing,
} from "./tools/billing-routing-optimize.js";

// ─── Billing Anomaly Detect tool (Phase 10A P0) ──────────────────────────────
export type {
  BillingAnomalyDetectInput,
  BillingAnomalyOutput,
  AnomalyRecord,
  AnomalySeverity,
  OverallSeverity,
  AnomalyBillingRegistry,
} from "./tools/billing-anomaly-detect.js";
export {
  billingAnomalyDetectTool,
  setAnomalyBillingRegistry,
  _resetAnomalyBillingRegistry,
} from "./tools/billing-anomaly-detect.js";

// ─── Sustainability: Carbon Estimate tool (Phase 11) ─────────────────────────
export type {
  SustainabilityCarbonEstimateInput,
  SustainabilityCarbonEstimateOutput,
  LowCarbonAlternative,
} from "./tools/sustainability-carbon-estimate.js";
export { sustainabilityCarbonEstimateTool } from "./tools/sustainability-carbon-estimate.js";

// ─── Rate Optimize tool (Phase 11) ───────────────────────────────────────────
export type {
  BillingRateOptimizeInput,
  BillingRateOptimizeOutput,
  RateOpportunity,
  CommitmentTier,
  RateOptimizeSummary,
  RateOptimizeAdapterRegistry,
} from "./tools/billing-rate-optimize.js";
export {
  billingRateOptimizeTool,
  setRateOptimizeBillingRegistry,
  _resetRateOptimizeBillingRegistry,
} from "./tools/billing-rate-optimize.js";

// ─── Usage Optimize tool (Phase 11) ──────────────────────────────────────────
export type {
  BillingUsageOptimizeInput,
  BillingUsageOptimizeOutput,
  UsageWasteRecord,
  WasteCategory,
  UsageOptimizeSummary,
  UsageOptimizeAdapterRegistry,
} from "./tools/billing-usage-optimize.js";
export {
  billingUsageOptimizeTool,
  setUsageOptimizeBillingRegistry,
  _resetUsageOptimizeBillingRegistry,
} from "./tools/billing-usage-optimize.js";

// ─── AI Quota tool (Phase 11) ─────────────────────────────────────────────────
export type {
  BillingAiQuotaInput,
  BillingAiQuotaOutput,
  ProviderQuota,
  ProviderQuotaStatus,
  QuotaStatus,
  AiQuotaSummary,
  AiQuotaAdapterRegistry,
} from "./tools/billing-ai-quota.js";
export {
  billingAiQuotaTool,
  setAiQuotaBillingRegistry,
  _resetAiQuotaBillingRegistry,
} from "./tools/billing-ai-quota.js";

// ─── Phase 12: FinOps Framework + AI gap closures ─────────────────────────────

// Showback / Chargeback report (F1)
export type {
  ShowbackRow,
  ShowbackSummary,
  BillingShowbackReportInput,
  BillingShowbackReportOutput,
  ShowbackAdapterRegistry,
} from "./tools/billing-showback-report.js";
export {
  billingShowbackReportTool,
  setShowbackBillingRegistry,
  _resetShowbackBillingRegistry,
} from "./tools/billing-showback-report.js";

// Tag governance / policy enforcement (F2)
export type {
  ViolationSeverity,
  TagViolation,
  TagGovernanceSummary,
  BillingTagGovernanceInput,
  BillingTagGovernanceOutput,
} from "./tools/billing-tag-governance.js";
export { billingTagGovernanceTool } from "./tools/billing-tag-governance.js";

// Budget alerting (F3)
export type {
  ProviderBudget,
  BudgetAlert,
  BudgetStatus,
  BillingBudgetAlertInput,
  BillingBudgetAlertOutput,
} from "./tools/billing-budget-alert.js";
export { billingBudgetAlertTool } from "./tools/billing-budget-alert.js";

// PR-level cost attribution / shift-left FinOps (F8 / I5)
export type {
  PrCostDriverCategory,
  PrCostDriver,
  PrRiskLevel,
  BillingAttributionPrInput,
  BillingAttributionPrOutput,
} from "./tools/billing-attribution-pr.js";
export { billingAttributionPrTool } from "./tools/billing-attribution-pr.js";

// AI cost attribution by model / team / feature (A2)
export type {
  AiAttributionRow,
  AiAttributionSummary,
  BillingAiAttributionInput,
  BillingAiAttributionOutput,
  AiAttributionRegistry,
} from "./tools/billing-ai-attribution.js";
export {
  billingAiAttributionTool,
  setAiAttributionRegistry,
  _resetAiAttributionRegistry,
} from "./tools/billing-ai-attribution.js";

// AI cost forecasting (A7)
export type {
  ForecastDataPoint,
  BillingAiCostForecastInput,
  BillingAiCostForecastOutput,
} from "./tools/billing-ai-cost-forecast.js";
export { billingAiCostForecastTool } from "./tools/billing-ai-cost-forecast.js";

// AI model performance vs cost tradeoff (A6)
export type {
  PerfMetric,
  ModelPerfRecord,
  BillingAiModelPerfInput,
  BillingAiModelPerfOutput,
} from "./tools/billing-ai-model-perf.js";
export { billingAiModelPerfTool } from "./tools/billing-ai-model-perf.js";

// AI token budget enforcement / rate-limit tracking (A4)
export type {
  RateLimitStatus,
  TokenBudgetPeriod,
  TokenBudget,
  RateLimitViolation,
  ProviderRateLimitStatus,
  RateLimitSummary,
  BillingAiRatelimitInput,
  BillingAiRatelimitOutput,
  AiRatelimitRegistry,
} from "./tools/billing-ai-ratelimit.js";
export {
  billingAiRatelimitTool,
  setAiRatelimitRegistry,
  _resetAiRatelimitRegistry,
} from "./tools/billing-ai-ratelimit.js";
