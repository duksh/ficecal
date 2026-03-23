// ─── @ficecal/billing-ai-providers ────────────────────────────────────────────
//
// AI provider billing adapter layer for FiceCal v2.
//
// Architecture:
//   provider usage API → ProviderUsageRecord[] (token counts)
//   ficecal-model-lens  → ModelPricingReference[] (per-token rates)
//   normalize.ts        → NormalizedCostRecord[]  (FOCUS 1.3)
//
// Phase 10A P1+P2: interface, normalize, model-lookup, 6 provider adapters.

// ─── Core contracts ────────────────────────────────────────────────────────────
export type {
  ProviderCredentials,
  ProviderUsageRecord,
  AiProviderBillingAdapter,
} from "./interface.js";
export { CredentialsRequiredError } from "./interface.js";

// ─── Normalization ─────────────────────────────────────────────────────────────
export type { NormalizeOptions, NormalizeResult } from "./normalize.js";
export { normalizeUsageRecords } from "./normalize.js";

// ─── Model pricing lookup ──────────────────────────────────────────────────────
export { lookupModelPricing } from "./model-lookup.js";

// ─── Provider adapters ─────────────────────────────────────────────────────────
export { anthropicAdapter } from "./adapters/anthropic.js";
export { openAiAdapter }    from "./adapters/openai.js";
export { geminiAdapter }    from "./adapters/gemini.js";
export { mistralAdapter }   from "./adapters/mistral.js";
export { deepSeekAdapter }  from "./adapters/deepseek.js";
export { alibabaAdapter }   from "./adapters/alibaba.js";

// ─── Registry helper ───────────────────────────────────────────────────────────
//
// A Map of all built-in adapters keyed by providerId.
// Consumers can extend this with custom adapters.

import type { AiProviderBillingAdapter } from "./interface.js";
import { anthropicAdapter } from "./adapters/anthropic.js";
import { openAiAdapter }    from "./adapters/openai.js";
import { geminiAdapter }    from "./adapters/gemini.js";
import { mistralAdapter }   from "./adapters/mistral.js";
import { deepSeekAdapter }  from "./adapters/deepseek.js";
import { alibabaAdapter }   from "./adapters/alibaba.js";

export const AI_PROVIDER_ADAPTERS: ReadonlyMap<string, AiProviderBillingAdapter> = new Map([
  [anthropicAdapter.providerId, anthropicAdapter],
  [openAiAdapter.providerId,    openAiAdapter],
  [geminiAdapter.providerId,    geminiAdapter],
  [mistralAdapter.providerId,   mistralAdapter],
  [deepSeekAdapter.providerId,  deepSeekAdapter],
  [alibabaAdapter.providerId,   alibabaAdapter],
]);
