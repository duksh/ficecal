// ─── AI Provider Billing Plugin ───────────────────────────────────────────────
//
// Wraps @ficecal/billing-ai-providers adapters (Anthropic, OpenAI, Gemini,
// Mistral, DeepSeek, Alibaba) into an AnomalyBillingRegistry-compatible
// object so they can be used by billing.anomaly.detect and the upcoming
// finops.assessment.correlate and billing.routing.optimize tools.
//
// Pricing oracle: catalog loaded via catalog-loader.ts (tries MCP_MODEL_CATALOG_URL
// env var → bundled fixture). The module-level _pricingCatalog is populated by
// initializeCatalog() in registry.ts before the server accepts requests.
//
// Fallback: if initializeCatalog() has not been called (e.g. in unit tests),
// _pricingCatalog holds the bundled Phase 10 fixture entries read synchronously
// at module evaluation time.
//
// Design:
//   AI_PROVIDER_ADAPTERS.get(providerId).fetchUsage()
//     → ProviderUsageRecord[]
//     → normalizeUsageRecords(usage, { pricingCatalog: _pricingCatalog })
//     → NormalizedCostRecord[]   ← what AnomalyBillingRegistry.load() returns

import type { AnomalyBillingRegistry } from "@ficecal/mcp-tooling";
import { AI_PROVIDER_ADAPTERS, normalizeUsageRecords } from "@ficecal/billing-ai-providers";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ─── Bundled fixture (synchronous fallback for tests / early calls) ───────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_FIXTURE_PATH = path.resolve(__dirname, "../../fixtures/model-pricing-catalog.json");

function _loadBundledFixture(): ModelPricingReference[] {
  try {
    const raw = readFileSync(BUNDLED_FIXTURE_PATH, "utf-8");
    return JSON.parse(raw) as ModelPricingReference[];
  } catch {
    // If fixture is missing (e.g. partial test environment), return empty array.
    return [];
  }
}

// ─── Module-level catalog (replaced by initializeCatalog in production) ───────

let _pricingCatalog: ModelPricingReference[] = _loadBundledFixture();

/**
 * Replaces the pricing catalog used by all AI provider adapters.
 * Called by initializeCatalog() in registry.ts after loading from the oracle.
 */
export function setAiProviderPricingCatalog(catalog: ModelPricingReference[]): void {
  _pricingCatalog = catalog;
}

/**
 * Resets the pricing catalog to the bundled fixture.
 * For use in tests / _resetRegistry() only.
 */
export function _resetAiProviderPricingCatalog(): void {
  _pricingCatalog = _loadBundledFixture();
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an AnomalyBillingRegistry that wraps all AI provider adapters from
 * @ficecal/billing-ai-providers. The load() function fetches fixture usage and
 * normalises it to NormalizedCostRecord[] using the Phase 10 hardcoded catalog.
 *
 * Returns the AI provider registry. Callers should compose this with the cloud
 * billing registry (from PluginHost) via createMergedBillingRegistry().
 */
export function createAiProviderBillingRegistry(): AnomalyBillingRegistry {
  return {
    getAdapter(provider: string) {
      const adapter = AI_PROVIDER_ADAPTERS.get(provider);
      if (!adapter) return undefined;

      return {
        ingestMode: adapter.ingestMode,
        async load(start: string, end: string): Promise<unknown> {
          const usage = await adapter.fetchUsage(start, end, {});
          const { records } = normalizeUsageRecords(usage, {
            providerId:         adapter.providerId,
            displayName:        adapter.displayName,
            pricingCatalog:     _pricingCatalog,
            billingPeriodStart: start,
            billingPeriodEnd:   end,
            sourceSystem:       `ficecal-billing-${provider}-deterministic`,
            ingestedAt:         new Date().toISOString(),
          });
          // Returns NormalizedCostRecord[] — anomaly-detect extractRecords() handles this natively
          return records;
        },
      };
    },

    getFixture(provider: string) {
      const adapter = AI_PROVIDER_ADAPTERS.get(provider);
      if (!adapter || adapter.ingestMode !== "deterministic") return undefined;
      return { version: "phase-10-deterministic" };
    },
  };
}

/**
 * Merges the AI provider registry with the cloud billing registry.
 * AI providers (anthropic, openai, google, mistral, deepseek, alibaba) are
 * resolved from aiReg; cloud providers (aws, gcp, azure) fall back to cloudReg.
 */
export function createMergedBillingRegistry(
  cloudReg: AnomalyBillingRegistry,
  aiReg: AnomalyBillingRegistry,
): AnomalyBillingRegistry {
  return {
    getAdapter(provider: string) {
      return aiReg.getAdapter(provider) ?? cloudReg.getAdapter(provider);
    },
    getFixture(provider: string) {
      return aiReg.getFixture(provider) ?? cloudReg.getFixture(provider);
    },
  };
}
