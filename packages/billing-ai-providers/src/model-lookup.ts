// ─── Model lookup — ModelPricingReference resolver ───────────────────────────
//
// Given a raw model ID from a provider usage API and a provider ID,
// finds the best matching ModelPricingReference from the ficecal-model-lens
// catalog (already normalised by duksh-models-adapter).
//
// Match strategy (in priority order):
//   1. Exact modelId match + company match
//   2. Exact modelId match (any vendor)
//   3. cleanName contains rawModelId (case-insensitive)
//   4. rawModelId contains cleanName slug (case-insensitive)
//
// Returns null if no match found — caller receives dataCompleteness: "partial"
// but still emits a record with amount: "0.0000000000" and a warning.

import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Provider id → ModelPricingReference company mapping ─────────────────────
//
// Bridges the adapter's providerId (lowercase) to the company field used in
// ModelPricingReference records from ficecal-model-lens.

const PROVIDER_TO_COMPANY: Record<string, string[]> = {
  anthropic: ["Anthropic"],
  openai:    ["OpenAI"],
  google:    ["Google", "Google DeepMind"],
  mistral:   ["Mistral AI"],
  deepseek:  ["DeepSeek"],
  alibaba:   ["Alibaba", "Alibaba Cloud"],
  cohere:    ["Cohere"],
  ibm:       ["IBM"],
  groq:      ["Meta", "Mistral AI", "Google"],  // Groq serves multiple model families
};

/**
 * Normalise a raw model ID or name into a slug for fuzzy matching.
 * Lowercases and strips version date suffixes (e.g. "-20241022").
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/-\d{8}$/, "")       // strip date suffix "-20241022"
    .replace(/[^a-z0-9-]/g, "-")  // non-alphanumeric → hyphen
    .replace(/-+/g, "-")          // collapse multiple hyphens
    .replace(/^-|-$/g, "");       // trim leading/trailing hyphens
}

/**
 * Find the best ModelPricingReference for a raw provider model ID.
 *
 * @param rawModelId   Model id as returned by the provider API (e.g. "claude-3-5-sonnet-20241022")
 * @param providerId   Adapter providerId (e.g. "anthropic")
 * @param catalog      Full ModelPricingReference[] from duksh-models-adapter
 * @param regionCode   Optional preferred region (e.g. "us-east-1"); falls back to "global"
 */
export function lookupModelPricing(
  rawModelId: string,
  providerId: string,
  catalog: ModelPricingReference[],
  regionCode?: string,
): ModelPricingReference | null {
  if (catalog.length === 0) return null;

  const companies = PROVIDER_TO_COMPANY[providerId] ?? [];
  const rawSlug   = slugify(rawModelId);

  // Filter to token-based records only (image models not relevant for usage APIs)
  const tokenRecords = catalog.filter((r) => r.pricingUnit !== "per_image");

  // ── Pass 1: exact modelId + company match ───────────────────────────────
  for (const company of companies) {
    const match = tokenRecords.find(
      (r) => slugify(r.modelId) === rawSlug && r.company === company,
    );
    if (match) return preferRegion(matchAll(tokenRecords, rawSlug, company), regionCode);
  }

  // ── Pass 2: exact modelId match, any vendor ──────────────────────────────
  const pass2 = tokenRecords.filter((r) => slugify(r.modelId) === rawSlug);
  if (pass2.length > 0) return preferRegion(pass2, regionCode);

  // ── Pass 3: cleanName slug contains rawModelId slug ──────────────────────
  const pass3 = tokenRecords.filter((r) =>
    companies.length === 0
      ? slugify(r.cleanName).includes(rawSlug)
      : companies.includes(r.company) && slugify(r.cleanName).includes(rawSlug),
  );
  if (pass3.length > 0) return preferRegion(pass3, regionCode);

  // ── Pass 4: rawModelId slug contains cleanName slug (substring of raw) ───
  const pass4 = tokenRecords.filter((r) =>
    companies.length === 0
      ? rawSlug.includes(slugify(r.cleanName))
      : companies.includes(r.company) && rawSlug.includes(slugify(r.cleanName)),
  );
  if (pass4.length > 0) return preferRegion(pass4, regionCode);

  return null;
}

function matchAll(
  records: ModelPricingReference[],
  slug: string,
  company: string,
): ModelPricingReference[] {
  return records.filter(
    (r) => slugify(r.modelId) === slug && r.company === company,
  );
}

/**
 * From a set of matching records, prefer one in the requested region.
 * Falls back to "global" then any record.
 */
function preferRegion(
  records: ModelPricingReference[],
  regionCode: string | undefined,
): ModelPricingReference {
  if (records.length === 1) return records[0]!;

  if (regionCode) {
    const exact = records.find((r) => r.regionCode === regionCode);
    if (exact) return exact;
  }
  const global = records.find((r) => r.regionCode === "global");
  return global ?? records[0]!;
}
