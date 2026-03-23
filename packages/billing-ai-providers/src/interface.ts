// ─── AiProviderBillingAdapter — contract ──────────────────────────────────────
//
// All AI provider billing adapters implement this interface.
// Each adapter is responsible only for fetching token usage counts from the
// provider's usage API. Cost calculation is handled by normalize.ts using
// ModelPricingReference rates from ficecal-model-lens.
//
// Design principle:
//   adapter → token counts (ProviderUsageRecord[])
//   normalize.ts → NormalizedCostRecord[] via ModelPricingReference rates
//
// This means pricing logic lives in one place (normalize.ts / model-lens),
// not distributed across 6+ adapter files.

import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Credentials ──────────────────────────────────────────────────────────────

/**
 * Credentials passed to an adapter at call time.
 * Adapters only consume the keys they need — all fields are optional.
 * Deterministic (fixture) adapters ignore credentials entirely.
 */
export interface ProviderCredentials {
  apiKey?: string;
  organizationId?: string;
  projectId?: string;
  /** GCP/Vertex AI project */
  gcpProject?: string;
  /** GCP/Vertex AI location */
  gcpLocation?: string;
  /** Alibaba DashScope key */
  dashscopeKey?: string;
}

// ─── Usage record ──────────────────────────────────────────────────────────────

/**
 * Raw token usage for one model in one period, as returned by the provider API.
 * Provider adapters emit these; normalize.ts converts them to NormalizedCostRecord.
 */
export interface ProviderUsageRecord {
  /** Raw model identifier as returned by the provider API. */
  modelId: string;

  /** Total input tokens consumed in the period. */
  inputTokens: number;

  /** Total output tokens consumed in the period. */
  outputTokens: number;

  /** Cached/prompt-cache input tokens (Anthropic, OpenAI). */
  cachedInputTokens?: number;

  /** Number of API requests (where available). */
  requestCount?: number;

  /** Provider-native currency (ISO 4217). Default "USD". */
  currency?: string;

  /** Charge period start — ISO date "YYYY-MM-DD". */
  periodStart: string;

  /** Charge period end — ISO date "YYYY-MM-DD". */
  periodEnd: string;

  /** Provider account / organisation identifier. */
  organizationId?: string;

  /** Project or workspace identifier within the account. */
  projectId?: string;
}

// ─── Adapter interface ─────────────────────────────────────────────────────────

export interface AiProviderBillingAdapter {
  /** Canonical provider id — must match ModelPricingReference.company (lowercased). */
  readonly providerId: string;

  /** Human-readable provider name for display and FOCUS ServiceName. */
  readonly displayName: string;

  /**
   * Ingest mode:
   *   "deterministic" — returns fixture data; safe in CI without credentials
   *   "live"          — calls the real provider usage API
   */
  readonly ingestMode: "deterministic" | "live";

  /**
   * Fetch token usage records for the given period.
   * Deterministic adapters ignore credentials and period bounds.
   * Live adapters require credentials and throw CredentialsRequiredError if absent.
   */
  fetchUsage(
    periodStart: string,
    periodEnd: string,
    credentials: ProviderCredentials,
    pricingCatalog?: ModelPricingReference[],
  ): Promise<ProviderUsageRecord[]>;
}

// ─── Errors ────────────────────────────────────────────────────────────────────

export class CredentialsRequiredError extends Error {
  readonly code = "CREDENTIALS_REQUIRED";
  readonly providerId: string;

  constructor(providerId: string, missingKey: string) {
    super(
      `Live billing for provider "${providerId}" requires credential "${missingKey}". ` +
      `Set it in ProviderCredentials or configure the relevant environment variable.`,
    );
    this.providerId = providerId;
  }
}
