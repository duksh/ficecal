// ─── Tool Registry Bootstrap ──────────────────────────────────────────────────
//
// Creates and pre-populates the singleton McpToolRegistry with all tools.
//
// Phase 5:  economics tools (cost estimate, health score, period normalize)
// Phase 6:  billing tools (estimate actual, compare period) + 4 provider plugins
// Phase 7:  HookRegistry wired on PluginHost; known feature flags declared;
//           live billing support gated by FICECAL_LIVE_BILLING env var;
//           WorkspaceRegistry available via getWorkspaceRegistry().
// Phase 8:  billing.commitment.status tool (FOCUS 1.3 CommitmentDiscount dataset)
// Phase 9:  billing.chargeback.allocate tool (FOCUS 1.3 Allocation columns)
//           finops.assessment.run tool (FinOps Framework 2026 maturity assessment)
// Phase 10: billing.anomaly.detect tool (threshold-based spike detection)
//           @ficecal/billing-ai-providers wired via createMergedBillingRegistry
// Phase 11: sustainability.carbon.estimate (carbon economics engine)
//           billing.rate.optimize (commitment vs on-demand rate analysis)
//           billing.usage.optimize (rightsizing / waste detection)
//           billing.ai.quota (AI provider spend quota management)
// Phase 12: billing.showback.report (F1 showback/chargeback reporting)
//           billing.tag.governance (F2 tag policy enforcement)
//           billing.budget.alert (F3 proactive spend alerts)
//           billing.attribution.pr (F8/I5 shift-left PR cost delta)
//           billing.ai.attribution (A2 per-model cost attribution)
//           billing.ai.cost.forecast (A7 AI spend forecasting)
//           billing.ai.model.perf (A6 model performance vs cost tradeoff)

import { McpToolRegistry } from "@ficecal/mcp-tooling";
import { costEstimateTool } from "@ficecal/mcp-tooling";
import { healthScoreQueryTool } from "@ficecal/mcp-tooling";
import { periodNormalizeTool } from "@ficecal/mcp-tooling";
import {
  billingEstimateActualTool,
  billingComparePeriodTool,
  billingCommitmentStatusTool,
  billingChargebackAllocateTool,
  finOpsAssessmentRunTool,
  billingAnomalyDetectTool,
  finOpsAssessmentCorrelateTool,
  billingRoutingOptimizeTool,
  // Phase 11
  sustainabilityCarbonEstimateTool,
  billingRateOptimizeTool,
  billingUsageOptimizeTool,
  billingAiQuotaTool,
  // Phase 12
  billingShowbackReportTool,
  billingTagGovernanceTool,
  billingBudgetAlertTool,
  billingAttributionPrTool,
  billingAiAttributionTool,
  billingAiCostForecastTool,
  billingAiModelPerfTool,
  billingAiRatelimitTool,
  setEstimateBillingRegistry,
  setCompareBillingRegistry,
  setAnomalyBillingRegistry,
  setCorrelationBillingRegistry,
  setRoutingBillingRegistry,
  setRoutingCatalog,
  _resetRoutingCatalog,
  buildRoutingCatalogFromPricing,
} from "@ficecal/mcp-tooling";

import { PluginHost, WorkspaceRegistry } from "@ficecal/plugin-api";
import { awsBillingPlugin } from "../plugins/aws-billing-plugin.js";
import { gcpBillingPlugin } from "../plugins/gcp-billing-plugin.js";
import { azureBillingPlugin } from "../plugins/azure-billing-plugin.js";
import { openaiBillingPlugin } from "../plugins/openai-billing-plugin.js";
import {
  createAiProviderBillingRegistry,
  createMergedBillingRegistry,
  setAiProviderPricingCatalog,
  _resetAiProviderPricingCatalog,
} from "../plugins/ai-providers-billing-plugin.js";
import { loadModelPricingCatalog } from "../plugins/catalog-loader.js";

// ─── Known feature flags ──────────────────────────────────────────────────────
//
// Declared on the PluginHost so the admin panel (Phase 7 P1) and any health
// endpoint can list them.  Active flags are read from env at startup:
//   FICECAL_LIVE_BILLING=1   → activates "live-billing"
//   FICECAL_COMMIT_MGMT=1    → activates "commitment-management"

const ACTIVE_FLAGS: string[] = [];
if (process.env["FICECAL_LIVE_BILLING"] === "1") ACTIVE_FLAGS.push("live-billing");
if (process.env["FICECAL_COMMIT_MGMT"] === "1")  ACTIVE_FLAGS.push("commitment-management");

const KNOWN_FLAGS = [
  {
    key: "commitment-management",
    displayName: "Commitment Management",
    description: "RI/SP commitment tracking panels and MCP tools.",
    phase: "Phase 1",
  },
  {
    key: "shared-cost-allocation",
    displayName: "Shared Cost Allocation",
    description: "Distribute shared infrastructure costs across workspaces.",
    phase: "Phase 1",
  },
  {
    key: "live-billing",
    displayName: "Live Billing Ingestion",
    description:
      "Enable real-time billing adapter calls to provider APIs. " +
      "Phase 7 stub — full SDK integration in Phase 8. " +
      "Activate via FICECAL_LIVE_BILLING=1.",
    phase: "Phase 7",
  },
  {
    key: "workspace-scoping",
    displayName: "Workspace-scoped Plugins",
    description: "Scope plugin contributions per workspace via WorkspaceRegistry.",
    phase: "Phase 7",
  },
] as const;

// ─── Singletons ───────────────────────────────────────────────────────────────

let _registry: McpToolRegistry | null = null;
let _pluginHost: PluginHost | null = null;
let _workspaceRegistry: WorkspaceRegistry | null = null;

// ─── Catalog initialization ───────────────────────────────────────────────────

/**
 * Loads the model pricing catalog from the oracle (MCP_MODEL_CATALOG_URL env →
 * bundled fixture fallback) and wires it into:
 *   - AI provider billing plugin (normalizeUsageRecords pricing)
 *   - billing.routing.optimize routing catalog (tier-based substitution)
 *
 * Must be called BEFORE getToolRegistry() on every server boot so that the
 * module-level catalogs are populated before the registry is built.
 * Idempotent — safe to call multiple times (re-loads and re-wires each call).
 *
 * Tests that call getToolRegistry() directly skip this function; they use the
 * bundled fixture loaded synchronously at module evaluation time.
 */
export async function initializeCatalog(): Promise<void> {
  const { catalog } = await loadModelPricingCatalog();
  setAiProviderPricingCatalog(catalog);
  setRoutingCatalog(buildRoutingCatalogFromPricing(catalog));
}

/**
 * Returns the singleton tool registry, creating and populating it on first call.
 * Idempotent — safe to call multiple times.
 *
 * Phase 7 bootstrap:
 * 1. Create McpToolRegistry and register Phase 5 economics tools
 * 2. Create PluginHost with active feature flags from env
 * 3. Declare all known feature flags for admin panel visibility
 * 4. Register 4 provider billing plugins (AWS, GCP, Azure, OpenAI)
 *    AWS plugin is in live mode when FICECAL_LIVE_BILLING=1
 * 5. Wire BillingRegistry into billing tool module-level registries
 * 6. Register billing MCP tools
 * 7. Create WorkspaceRegistry backed by PluginHost
 */
export function getToolRegistry(): McpToolRegistry {
  if (_registry !== null) return _registry;

  const registry = new McpToolRegistry();

  // ── Phase 5: economics tools ────────────────────────────────────────────────
  registry.register(costEstimateTool);
  registry.register(healthScoreQueryTool);
  registry.register(periodNormalizeTool);

  // ── Phase 6/7: billing plugins ──────────────────────────────────────────────
  // PluginHost routes billing fixtures + adapters to BillingRegistry.
  // McpToolRegistrar wrapper forwards .register() calls back to our registry.
  const mcpRegistrar = {
    register: (tool: unknown) =>
      registry.register(tool as Parameters<typeof registry.register>[0]),
  };
  const host = new PluginHost(mcpRegistrar, ACTIVE_FLAGS);

  // ── Phase 7: declare known feature flags for admin panel ────────────────────
  for (const descriptor of KNOWN_FLAGS) {
    host.declareFeatureFlag(descriptor);
  }

  // ── Phase 7: hook observability — log plugin registrations ─────────────────
  host.hooks.addAction("plugin.registered", (plugin) => {
    const p = plugin as { id: string; version: string };
    // In production replace with structured logger
    if (process.env["NODE_ENV"] !== "test") {
      console.log(`[ficecal:registry] plugin registered: ${p.id}@${p.version}`);
    }
  });

  // ── Phase 6/7: register billing plugins ────────────────────────────────────
  host.register(awsBillingPlugin);
  host.register(gcpBillingPlugin);
  host.register(azureBillingPlugin);
  host.register(openaiBillingPlugin);

  // Wire the BillingRegistry into billing tool handlers
  const billingReg = host.billing;
  setEstimateBillingRegistry(billingReg);
  setCompareBillingRegistry(billingReg);

  // Phase 10: merged registry combines cloud billing (Phase 6/7) + AI provider adapters (Phase 10).
  // AI providers (anthropic, openai, google, mistral, deepseek, alibaba) are resolved first;
  // cloud providers (aws, gcp, azure) fall through to the existing BillingRegistry.
  const aiProviderReg    = createAiProviderBillingRegistry();
  const mergedAnomalyReg = createMergedBillingRegistry(billingReg, aiProviderReg);

  // Wire merged registry into all Phase 10 tools
  setAnomalyBillingRegistry(mergedAnomalyReg);
  setCorrelationBillingRegistry(mergedAnomalyReg);  // correlate needs cloud + AI spend
  setRoutingBillingRegistry(aiProviderReg);          // routing is AI-only

  // Register billing MCP tools (after registry is wired)
  registry.register(billingEstimateActualTool);
  registry.register(billingComparePeriodTool);
  // Phase 8: commitment status tool uses built-in fixtures — no adapter wiring needed
  registry.register(billingCommitmentStatusTool);
  // Phase 9: chargeback allocate tool (FOCUS 1.3 Allocation columns — deterministic fixtures)
  registry.register(billingChargebackAllocateTool);
  // Phase 9: FinOps Framework 2026 assessment engine (crawl/walk/run scoring)
  registry.register(finOpsAssessmentRunTool);
  // Phase 10: billing anomaly detection (threshold-based spike detection over NormalizedCostRecord[])
  registry.register(billingAnomalyDetectTool);
  // Phase 10: assessment × billing correlation (ROI-ranked capability-gap recommendations)
  registry.register(finOpsAssessmentCorrelateTool);
  // Phase 10: AI model routing optimization (top-N model-swap opportunities by monthly saving)
  registry.register(billingRoutingOptimizeTool);

  // ── Phase 11: sustainability + rate/usage/quota tools ───────────────────────
  // Carbon emissions estimation (FinOps Framework 2026 Sustainability capability)
  registry.register(sustainabilityCarbonEstimateTool);
  // Commitment vs on-demand rate conversion opportunities
  registry.register(billingRateOptimizeTool);
  // Rightsizing + waste detection (idle / overprovisioned / orphaned resources)
  registry.register(billingUsageOptimizeTool);
  // AI provider spend quota management per workspace
  registry.register(billingAiQuotaTool);

  // ── Phase 12: FinOps Framework + AI gap closures ─────────────────────────────
  // Showback / chargeback report — team / project / cost-center visibility (F1)
  registry.register(billingShowbackReportTool);
  // Tag governance — tag policy enforcement & compliance scoring (F2)
  registry.register(billingTagGovernanceTool);
  // Budget alerting — proactive spend alerts with threshold tiers (F3)
  registry.register(billingBudgetAlertTool);
  // PR-level cost attribution — shift-left FinOps (F8 / I5)
  registry.register(billingAttributionPrTool);
  // AI model cost attribution — per-request spend by model/team/feature (A2)
  registry.register(billingAiAttributionTool);
  // AI cost forecasting — linear / exponential projection (A7)
  registry.register(billingAiCostForecastTool);
  // AI model performance vs cost tradeoff analysis (A6)
  registry.register(billingAiModelPerfTool);
  // AI token budget enforcement / rate-limit tracking (A4)
  registry.register(billingAiRatelimitTool);

  // ── Phase 7: WorkspaceRegistry ──────────────────────────────────────────────
  _workspaceRegistry = new WorkspaceRegistry(host);

  _registry = registry;
  _pluginHost = host;
  return _registry;
}

/** Expose the PluginHost for inspection (health endpoint, admin routes). */
export function getPluginHost(): PluginHost | null {
  // Ensure bootstrap has run
  if (_pluginHost === null) getToolRegistry();
  return _pluginHost;
}

/** Expose the WorkspaceRegistry for per-workspace plugin scoping. */
export function getWorkspaceRegistry(): WorkspaceRegistry | null {
  if (_workspaceRegistry === null) getToolRegistry();
  return _workspaceRegistry;
}

/** Reset all singletons — for use in tests only. */
export function _resetRegistry(): void {
  _registry = null;
  _pluginHost = null;
  _workspaceRegistry = null;
  // Also reset the catalog module-level variables to their bundled fixture defaults.
  _resetAiProviderPricingCatalog();
  _resetRoutingCatalog();
}
