// ─── billing.routing.optimize — MCP tool ─────────────────────────────────────
//
// Identifies the top model-substitution opportunities across AI providers,
// ranked by estimated monthly saving. For each high-volume model, suggests
// lower-cost alternatives with similar capability profiles from ficecal-model-lens.
//
// Algorithm:
//   1. Load AI provider billing records from registry
//   2. Group by (provider, modelId) → total spend + token counts
//   3. For each model, look up 2–3 cheaper alternatives in the capability tier
//   4. Estimate monthly saving = currentCostPerToken × tokens × (1 - cheaperRate/currentRate)
//   5. Return top-N opportunities ranked by estimatedMonthlySaving DESC
//
// Routing tiers (Phase 10 deterministic, from ficecal-model-lens catalog):
//   premium  — claude-3-5-sonnet, gpt-4o, gemini-1.5-pro, mistral-large
//   standard — claude-3-5-haiku, gpt-4o-mini, gemini-2.0-flash, mistral-small
//   economy  — deepseek-chat, qwen-turbo, gemini-1.5-flash, codestral
//   reasoning — claude-3-opus, o1, deepseek-reasoner  (not substitutable)
//
// Tool id:   billing.routing.optimize
// Namespace: billing
// Stability: beta
// Phase: 10A P4

import type { McpToolDescriptor, McpToolResult, McpToolEnvelope } from "../types.js";
import type { NormalizedCostRecord } from "@ficecal/schemas/normalized-cost-record";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Registry (same shape as AnomalyBillingRegistry) ─────────────────────────

export interface RoutingBillingRegistry {
  getAdapter(provider: string): {
    load(start: string, end: string): Promise<unknown>;
    ingestMode?: "deterministic" | "live";
  } | undefined;
  getFixture(provider: string): { version: string } | undefined;
}

let _billingRegistry: RoutingBillingRegistry | null = null;

export function setRoutingBillingRegistry(registry: RoutingBillingRegistry): void {
  _billingRegistry = registry;
}

export function _resetRoutingBillingRegistry(): void {
  _billingRegistry = null;
}

// ─── Routing tiers ────────────────────────────────────────────────────────────
//
// A tier groups models of similar capability level.
// Substitutions are suggested within the same tier (lateral) or one tier down.
//
// Each entry: { modelId, provider, tier, inputCostPerM, outputCostPerM }

export type ModelTier = "reasoning" | "premium" | "standard" | "economy";

interface RoutingModelEntry {
  modelId:        string;
  provider:       string;
  tier:           ModelTier;
  inputCostPerM:  number;  // USD per 1M input tokens
  outputCostPerM: number;  // USD per 1M output tokens
  displayName:    string;
  notes:          string;
}

// Phase 10 hardcoded — Phase 11 replaces with live ficecal-model-lens catalog
const ROUTING_CATALOG: RoutingModelEntry[] = [
  // ── Reasoning tier (never substituted — unique reasoning capability) ───────
  { modelId: "claude-3-opus-20240229",      provider: "anthropic",  tier: "reasoning", inputCostPerM: 15.0,   outputCostPerM: 75.0,  displayName: "Claude 3 Opus",      notes: "Extended context reasoning" },
  { modelId: "o1",                          provider: "openai",     tier: "reasoning", inputCostPerM: 15.0,   outputCostPerM: 60.0,  displayName: "O1",                 notes: "Step-by-step reasoning" },
  { modelId: "deepseek-reasoner",           provider: "deepseek",   tier: "reasoning", inputCostPerM:  0.55,  outputCostPerM:  2.19, displayName: "DeepSeek R1",        notes: "Open reasoning model" },

  // ── Premium tier ──────────────────────────────────────────────────────────
  { modelId: "claude-3-5-sonnet-20241022",  provider: "anthropic",  tier: "premium",   inputCostPerM:  3.0,   outputCostPerM: 15.0,  displayName: "Claude 3.5 Sonnet",  notes: "Best-in-class instruction following" },
  { modelId: "gpt-4o",                      provider: "openai",     tier: "premium",   inputCostPerM:  2.5,   outputCostPerM: 10.0,  displayName: "GPT-4o",             notes: "Multimodal, strong reasoning" },
  { modelId: "gemini-1.5-pro",              provider: "google",     tier: "premium",   inputCostPerM:  1.25,  outputCostPerM:  5.0,  displayName: "Gemini 1.5 Pro",     notes: "2M context window" },
  { modelId: "mistral-large-latest",        provider: "mistral",    tier: "premium",   inputCostPerM:  2.0,   outputCostPerM:  6.0,  displayName: "Mistral Large",      notes: "Strong EU-hosted option" },

  // ── Standard tier ─────────────────────────────────────────────────────────
  { modelId: "claude-3-5-haiku-20241022",   provider: "anthropic",  tier: "standard",  inputCostPerM:  0.8,   outputCostPerM:  4.0,  displayName: "Claude 3.5 Haiku",   notes: "Fast, balanced" },
  { modelId: "gpt-4o-mini",                 provider: "openai",     tier: "standard",  inputCostPerM:  0.15,  outputCostPerM:  0.60, displayName: "GPT-4o Mini",        notes: "Highly cost-efficient" },
  { modelId: "gemini-2.0-flash",            provider: "google",     tier: "standard",  inputCostPerM:  0.10,  outputCostPerM:  0.40, displayName: "Gemini 2.0 Flash",   notes: "Very fast, low latency" },
  { modelId: "qwen-max",                    provider: "alibaba",    tier: "standard",  inputCostPerM:  0.04,  outputCostPerM:  0.12, displayName: "Qwen Max",           notes: "Competitive multimodal" },

  // ── Economy tier ──────────────────────────────────────────────────────────
  { modelId: "deepseek-chat",               provider: "deepseek",   tier: "economy",   inputCostPerM:  0.27,  outputCostPerM:  1.10, displayName: "DeepSeek V3",        notes: "Excellent quality/cost" },
  { modelId: "gemini-1.5-flash",            provider: "google",     tier: "economy",   inputCostPerM:  0.075, outputCostPerM:  0.30, displayName: "Gemini 1.5 Flash",   notes: "High speed, low cost" },
  { modelId: "mistral-small-latest",        provider: "mistral",    tier: "economy",   inputCostPerM:  0.2,   outputCostPerM:  0.60, displayName: "Mistral Small",      notes: "Efficient for simple tasks" },
  { modelId: "codestral-latest",            provider: "mistral",    tier: "economy",   inputCostPerM:  1.0,   outputCostPerM:  3.0,  displayName: "Codestral",          notes: "Code-specialized, cheaper than general" },
  { modelId: "qwen-plus",                   provider: "alibaba",    tier: "economy",   inputCostPerM:  0.012, outputCostPerM:  0.036, displayName: "Qwen Plus",         notes: "Good balance" },
  { modelId: "qwen-turbo",                  provider: "alibaba",    tier: "economy",   inputCostPerM:  0.004, outputCostPerM:  0.012, displayName: "Qwen Turbo",        notes: "Ultra-low cost" },
];

// ─── Routing catalog — live oracle support ────────────────────────────────────
//
// _routingCatalog starts as the Phase 10 hardcoded constant.
// initializeCatalog() in registry.ts calls setRoutingCatalog() with the
// catalog built from the loaded ModelPricingReference[] oracle, overriding it
// before the server accepts requests.  Tests use the default (unchanged).

let _routingCatalog: RoutingModelEntry[] = ROUTING_CATALOG;

/** Replaces the active routing catalog. Called by initializeCatalog(). */
export function setRoutingCatalog(catalog: RoutingModelEntry[]): void {
  _routingCatalog = catalog;
}

/** Resets to the built-in Phase 10 catalog. For tests / _resetRegistry(). */
export function _resetRoutingCatalog(): void {
  _routingCatalog = ROUTING_CATALOG;
}

// ─── Company → provider ID map (for buildRoutingCatalogFromPricing) ───────────

const COMPANY_TO_PROVIDER: Record<string, string> = {
  "Anthropic":     "anthropic",
  "OpenAI":        "openai",
  "Google":        "google",
  "Mistral AI":    "mistral",
  "DeepSeek":      "deepseek",
  "Alibaba Cloud": "alibaba",
};

// modelId → tier, seeded from the built-in ROUTING_CATALOG.
// When an incoming pricing entry has a modelId not in the map, defaults to "standard".
const MODEL_TIER_MAP: Record<string, ModelTier> = Object.fromEntries(
  ROUTING_CATALOG.map((e) => [e.modelId, e.tier]),
);

/**
 * Builds a RoutingModelEntry[] from a ModelPricingReference[] oracle response.
 * Used by initializeCatalog() to derive the routing catalog from the live
 * pricing oracle, replacing the hardcoded ROUTING_CATALOG at boot time.
 *
 * Tier classification: uses MODEL_TIER_MAP (seeded from ROUTING_CATALOG) for
 * known model IDs; unknown models default to "standard".
 * Notes: generated from company + sourceCatalog + sourceVersion.
 */
export function buildRoutingCatalogFromPricing(
  pricing: ModelPricingReference[],
): RoutingModelEntry[] {
  return pricing.map((p) => ({
    modelId:        p.modelId,
    provider:       COMPANY_TO_PROVIDER[p.company] ?? p.company.toLowerCase().replace(/\s+/g, "-"),
    tier:           MODEL_TIER_MAP[p.modelId] ?? "standard",
    inputCostPerM:  p.inputTokenCost ?? 0,
    outputCostPerM: p.outputTokenCost ?? 0,
    displayName:    p.cleanName,
    notes:          `${p.company} · ${p.sourceCatalog}@${p.sourceVersion}`,
  }));
}

// Tier downgrade path: reasoning models are never substituted
const TIER_DOWNGRADE: Record<ModelTier, ModelTier | null> = {
  reasoning: null,     // Cannot substitute reasoning
  premium:   "standard",
  standard:  "economy",
  economy:   null,     // Already lowest
};

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface BillingRoutingOptimizeInput {
  /** Billing period start. */
  periodStart: string;
  /** Billing period end. */
  periodEnd: string;
  /**
   * AI provider IDs to analyse. Defaults to all registered AI providers.
   * Cloud providers (aws, gcp, azure) are ignored — this tool is AI-specific.
   */
  providers?: string[];
  /**
   * Maximum number of routing opportunities to return. Default: 5.
   */
  topN?: number;
  /**
   * Minimum monthly saving (USD) to include an opportunity. Default: 10.
   * Filters out noise from tiny workloads.
   */
  minMonthlySaving?: number;
  /**
   * If true, only suggest alternatives from a different provider (cross-provider).
   * Default: false (within-provider and cross-provider both shown).
   */
  crossProviderOnly?: boolean;
}

export interface ModelAlternative {
  /** The suggested replacement model. */
  modelId:        string;
  provider:       string;
  displayName:    string;
  tier:           ModelTier;

  /** Cost per 1M input tokens (USD). */
  inputCostPerM:  number;
  outputCostPerM: number;

  /**
   * Estimated monthly saving if 100% of the source model's traffic is routed here.
   * USD, 10dp string.
   */
  estimatedMonthlySaving: string;

  /** Saving as % of current model cost. */
  savingPercent: number;

  notes: string;
}

export interface RoutingOpportunity {
  /** Source model being evaluated. */
  sourceModelId:  string;
  sourceProvider: string;
  sourceDisplayName: string;
  sourceTier:     ModelTier;

  /** Observed spend for this model in the period (USD). */
  observedSpend: string;

  /** Input + output token counts observed. */
  inputTokens:   number;
  outputTokens:  number;

  /**
   * Current cost per 1M input tokens (USD).
   * Derived from observed spend / observed tokens.
   */
  effectiveInputCostPerM:  number;
  effectiveOutputCostPerM: number;

  /**
   * Top alternative models ordered by estimatedMonthlySaving DESC.
   * Up to 3 alternatives per source model.
   */
  alternatives: ModelAlternative[];

  /**
   * Best single alternative saving for this model.
   * Equals alternatives[0].estimatedMonthlySaving.
   */
  bestAlternativeSaving: string;
}

export interface BillingRoutingOptimizeOutput {
  periodStart: string;
  periodEnd:   string;

  /** Routing opportunities ranked by bestAlternativeSaving DESC. */
  opportunities: RoutingOpportunity[];

  /**
   * Total monthly saving if all top alternatives are implemented.
   * Sum of each opportunity's bestAlternativeSaving.
   */
  totalEstimatedMonthlySaving: string;

  /** Number of models analysed. */
  modelsAnalysed: number;

  /** Number of opportunities found (after minMonthlySaving filter). */
  opportunitiesFound: number;

  /** Providers with billing data loaded. */
  providersCovered: string[];

  /** Providers requested but not in registry. */
  providersSkipped: string[];

  ingestMode: "deterministic" | "live" | "mixed";
  computedAt: string;
  /** Catalog version string — "phase-10-hardcoded" for bundled fixture, or
   *  the sourceVersion from the live oracle (e.g. "phase-10-hardcoded@2026-Q1"). */
  catalogVersion: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AI_PROVIDER_IDS = new Set([
  "anthropic", "openai", "google", "mistral", "deepseek", "alibaba",
]);

const DEFAULT_AI_PROVIDERS = ["anthropic", "openai", "google", "mistral", "deepseek", "alibaba"];

function extractRecords(raw: unknown): NormalizedCostRecord[] {
  if (Array.isArray(raw)) return raw as NormalizedCostRecord[];
  const data = raw as {
    provider: string;
    lineItems: Array<{ service: string; cost: number; currency: string; startDate: string; endDate: string }>;
    billingPeriodStart: string; billingPeriodEnd: string;
  };
  return data.lineItems.map((li, idx) => ({
    recordId:           `${data.provider}:${li.service}:${idx}`,
    sourceSystem:       `ficecal-billing-${data.provider}`,
    provider:           data.provider,
    providerRole:       "direct-provider" as const,
    billingPeriodStart: data.billingPeriodStart,
    billingPeriodEnd:   data.billingPeriodEnd,
    chargePeriodStart:  li.startDate,
    chargePeriodEnd:    li.endDate,
    currency:           li.currency,
    amount:             li.cost.toFixed(10),
    amountType:         "actual" as const,
    serviceName:        li.service,
    dataCompleteness:   "partial" as const,
    ingestedAt:         new Date().toISOString(),
    schemaVersion:      "2.0.0",
  }));
}

// Simple slugify for model ID comparison (strip date suffix, lowercase)
function slugify(s: string): string {
  return s.toLowerCase().replace(/-\d{8}$/, "").replace(/[^a-z0-9-]/g, "-");
}

function lookupRoutingEntry(modelId: string, provider: string): RoutingModelEntry | undefined {
  const rawSlug = slugify(modelId);
  // Exact slug match + provider
  return _routingCatalog.find(
    (e) => slugify(e.modelId) === rawSlug && e.provider === provider,
  ) ?? _routingCatalog.find(
    (e) => slugify(e.modelId) === rawSlug,
  ) ?? _routingCatalog.find(
    (e) => e.provider === provider && rawSlug.includes(slugify(e.modelId)),
  );
}

/** Days in period (inclusive). */
function periodDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
}

function resolveIngestMode(
  modes: Array<"deterministic" | "live" | undefined>,
): "deterministic" | "live" | "mixed" {
  if (modes.length === 0) return "deterministic";
  const unique = new Set(modes.filter(Boolean));
  if (unique.size === 1) {
    const m = [...unique][0]!;
    return m === "deterministic" ? "deterministic" : "live";
  }
  return "mixed";
}

// ─── Tool handler ─────────────────────────────────────────────────────────────

export const billingRoutingOptimizeTool: McpToolDescriptor = {
  id:          "billing.routing.optimize",
  name:        "Billing Routing Optimize",
  namespace:   "billing",
  stability:   "beta",
  description:
    "Identifies AI model-routing optimization opportunities across providers. " +
    "For each high-spend model, suggests lower-cost alternatives in the same " +
    "capability tier, ranked by estimated monthly saving. Uses ficecal-model-lens " +
    "pricing catalog. Returns top-N opportunities with totalEstimatedMonthlySaving.",

  inputSchema: {
    type:     "object",
    required: ["periodStart", "periodEnd"],
    properties: {
      periodStart:       { type: "string",  description: "Billing period start (YYYY-MM-DD)." },
      periodEnd:         { type: "string",  description: "Billing period end (YYYY-MM-DD)." },
      providers:         { type: "string",  description: "AI provider IDs to analyse (comma-separated). Defaults to all." },
      topN:              { type: "string",  description: "Maximum number of opportunities to return. Default: 5." },
      minMonthlySaving:  { type: "string",  description: "Minimum estimated monthly saving (USD) to surface. Default: 10." },
      crossProviderOnly: { type: "boolean", description: "Only suggest alternatives from a different provider. Default: false." },
    },
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (envelope: McpToolEnvelope<any>): Promise<McpToolResult<BillingRoutingOptimizeOutput>> => {
    const input   = envelope.input   as BillingRoutingOptimizeInput;
    const context = envelope.context;
    const {
      periodStart,
      periodEnd,
      providers         = DEFAULT_AI_PROVIDERS,
      topN              = 5,
      minMonthlySaving  = 10,
      crossProviderOnly = false,
    } = input;

    // Filter to AI providers only (cloud billing has no model-level routing)
    const aiProviders = providers.filter((p) => AI_PROVIDER_IDS.has(p));

    // ── Load billing data ────────────────────────────────────────────────────
    const ingestModes: Array<"deterministic" | "live" | undefined> = [];
    const providersCovered: string[] = [];
    const providersSkipped: string[] = [];
    const allRecords: NormalizedCostRecord[] = [];

    if (_billingRegistry !== null) {
      await Promise.all(
        aiProviders.map(async (provider) => {
          const adapter = _billingRegistry!.getAdapter(provider);
          if (!adapter) {
            providersSkipped.push(provider);
            return;
          }
          try {
            const raw = await adapter.load(periodStart, periodEnd);
            allRecords.push(...extractRecords(raw));
            providersCovered.push(provider);
            ingestModes.push(adapter.ingestMode);
          } catch {
            providersSkipped.push(provider);
          }
        }),
      );
    }

    // ── Group by (provider, resourceId/modelId) ──────────────────────────────
    type ModelKey = `${string}::${string}`;
    const byModel = new Map<ModelKey, {
      provider: string;
      modelId:  string;
      spend:    number;
      input:    number;
      output:   number;
    }>();

    for (const r of allRecords) {
      const modelId = r.resourceId ?? r.serviceName ?? "unknown";
      const key: ModelKey = `${r.provider}::${modelId}`;
      const existing = byModel.get(key) ?? { provider: r.provider, modelId, spend: 0, input: 0, output: 0 };
      byModel.set(key, {
        ...existing,
        spend: existing.spend + parseFloat(r.amount),
      });
    }

    // Note: NormalizedCostRecord doesn't carry raw token counts — they were
    // consumed in normalize.ts. We re-derive effective rates from observed spend
    // using the routing catalog's cost ratios (deterministic fixture mode).
    // Phase 11: pass-through token counts from ProviderUsageRecord directly.

    // ── Build routing opportunities ───────────────────────────────────────────
    const periodDayCount = periodDays(periodStart, periodEnd);
    const monthScale     = 30 / periodDayCount;  // extrapolate to 30-day month

    const opportunities: RoutingOpportunity[] = [];

    for (const [, { provider, modelId, spend }] of byModel) {
      if (spend <= 0) continue;

      const sourceEntry = lookupRoutingEntry(modelId, provider);
      if (!sourceEntry) continue;                            // unknown model
      if (sourceEntry.tier === "reasoning") continue;        // not substitutable

      const targetTier = TIER_DOWNGRADE[sourceEntry.tier];
      if (!targetTier) continue;                             // already lowest

      // Build alternatives list from target tier
      let alternatives = _routingCatalog.filter(
        (e) => e.tier === targetTier && (e.modelId !== sourceEntry.modelId),
      );

      if (crossProviderOnly) {
        alternatives = alternatives.filter((e) => e.provider !== provider);
      }

      if (alternatives.length === 0) continue;

      // Extrapolated monthly spend
      const monthlySpend = spend * monthScale;

      // For each alternative, compute saving assuming same token distribution
      // Saving = monthlySpend × (1 - alternativeTotalCost / sourceTotalCost)
      // where totalCost is weighted: 70% input + 30% output (typical ratio)
      const INPUT_WEIGHT  = 0.70;
      const OUTPUT_WEIGHT = 0.30;
      const sourceWeightedRate =
        sourceEntry.inputCostPerM  * INPUT_WEIGHT +
        sourceEntry.outputCostPerM * OUTPUT_WEIGHT;

      const scoredAlternatives: ModelAlternative[] = alternatives.map((alt) => {
        const altWeightedRate =
          alt.inputCostPerM  * INPUT_WEIGHT +
          alt.outputCostPerM * OUTPUT_WEIGHT;
        const savingRatio   = 1 - (altWeightedRate / sourceWeightedRate);
        const monthlySaving = Math.max(0, monthlySpend * savingRatio);
        const savingPct     = Math.round(savingRatio * 100);
        return {
          modelId:                alt.modelId,
          provider:               alt.provider,
          displayName:            alt.displayName,
          tier:                   alt.tier,
          inputCostPerM:          alt.inputCostPerM,
          outputCostPerM:         alt.outputCostPerM,
          estimatedMonthlySaving: monthlySaving.toFixed(10),
          savingPercent:          savingPct,
          notes:                  alt.notes,
        };
      });

      // Sort by estimatedMonthlySaving DESC, take top 3
      scoredAlternatives.sort(
        (a, b) => parseFloat(b.estimatedMonthlySaving) - parseFloat(a.estimatedMonthlySaving),
      );
      const top3 = scoredAlternatives.slice(0, 3);

      if (top3.length === 0) continue;

      const bestSaving = parseFloat(top3[0]!.estimatedMonthlySaving);
      if (bestSaving * 1 < minMonthlySaving) continue;  // below threshold

      opportunities.push({
        sourceModelId:      sourceEntry.modelId,
        sourceProvider:     provider,
        sourceDisplayName:  sourceEntry.displayName,
        sourceTier:         sourceEntry.tier,
        observedSpend:      spend.toFixed(10),
        inputTokens:        0,  // Phase 11: propagate raw counts
        outputTokens:       0,
        effectiveInputCostPerM:  sourceEntry.inputCostPerM,
        effectiveOutputCostPerM: sourceEntry.outputCostPerM,
        alternatives:       top3,
        bestAlternativeSaving: top3[0]!.estimatedMonthlySaving,
      });
    }

    // Rank by bestAlternativeSaving DESC, take topN
    opportunities.sort(
      (a, b) => parseFloat(b.bestAlternativeSaving) - parseFloat(a.bestAlternativeSaving),
    );
    const topOpportunities = opportunities.slice(0, topN);

    const totalSaving = topOpportunities.reduce(
      (sum, o) => sum + parseFloat(o.bestAlternativeSaving), 0,
    );

    // Derive catalog version from the active routing catalog's first entry notes
    // (set by buildRoutingCatalogFromPricing) or fall back to the hardcoded label.
    const catalogVersion = _routingCatalog[0]?.notes?.includes("@")
      ? (_routingCatalog[0].notes.split("@")[1] ?? "phase-10-hardcoded")
      : "phase-10-hardcoded";

    const output: BillingRoutingOptimizeOutput = {
      periodStart,
      periodEnd,
      opportunities:               topOpportunities,
      totalEstimatedMonthlySaving: totalSaving.toFixed(10),
      modelsAnalysed:              byModel.size,
      opportunitiesFound:          topOpportunities.length,
      providersCovered,
      providersSkipped,
      ingestMode:     resolveIngestMode(ingestModes),
      computedAt:     new Date().toISOString(),
      catalogVersion,
    };

    const warnings: string[] = [
      ...(providersSkipped.length > 0
        ? [`Providers skipped: ${providersSkipped.join(", ")}`]
        : []),
      "Token counts not available in NormalizedCostRecord — savings estimated from observed spend ratios. Phase 11 will use raw token counts for exact calculations.",
    ];

    return {
      output,
      toolId:     billingRoutingOptimizeTool.id,
      executedAt: new Date().toISOString(),
      requestId:  context.requestId,
      warnings,
      appliedIds: [
        "billing.routing.tier-downgrade.v1",
        `billing.routing.ingest.${output.ingestMode}`,
        `billing.routing.catalog.${catalogVersion}`,
      ],
    };
  },
};
