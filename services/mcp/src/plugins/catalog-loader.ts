// ─── Model Pricing Catalog Loader ─────────────────────────────────────────────
//
// Loads the ModelPricingReference[] catalog used by ai-providers-billing-plugin
// and billing-routing-optimize. Two sources, tried in order:
//
//   1. MCP_MODEL_CATALOG_URL env var — HTTP GET → expects a JSON array of
//      ModelPricingReference (live rates from ficecal-model-lens data.json or
//      any compatible pricing oracle).
//
//   2. Bundled fixture — services/mcp/fixtures/model-pricing-catalog.json
//      (co-deployed with the service, deterministic Phase 10 rates).
//
// Phase 11: implement signed-catalog verification before loading remote URLs.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import type { ModelPricingReference } from "@ficecal/schemas/model-catalog";

// ─── Bundled fixture path ─────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Works for both tsx (src/plugins/) and tsc (dist/plugins/) — both are 2 dirs
// below the service root, so ../../fixtures resolves to services/mcp/fixtures/.
const BUNDLED_FIXTURE_PATH = path.resolve(__dirname, "../../fixtures/model-pricing-catalog.json");

// ─── Loader ───────────────────────────────────────────────────────────────────

/**
 * Loads the model pricing catalog.
 *
 * If MCP_MODEL_CATALOG_URL is set, attempts an HTTP GET to that URL and parses
 * the response as ModelPricingReference[].  On any error (network, parse, schema)
 * falls back to the bundled fixture — the service will still boot.
 *
 * If MCP_MODEL_CATALOG_URL is not set, reads the bundled fixture synchronously
 * (no network round-trip on every boot).
 *
 * Returns the catalog entries and the source that was used.
 */
export async function loadModelPricingCatalog(): Promise<{
  catalog:       ModelPricingReference[];
  source:        "remote" | "fixture";
  sourceVersion: string;
}> {
  const remoteUrl = process.env["MCP_MODEL_CATALOG_URL"];

  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl, {
        headers: { Accept: "application/json" },
        signal:  AbortSignal.timeout(8_000),  // 8 s timeout
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${remoteUrl}`);
      }
      const json = await res.json() as unknown;
      const catalog = validateCatalog(json);
      const sourceVersion = deriveSourceVersion(catalog);
      if (process.env["NODE_ENV"] !== "test") {
        console.log(
          `[ficecal:catalog-loader] loaded ${catalog.length} entries from remote ${remoteUrl} (${sourceVersion})`,
        );
      }
      return { catalog, source: "remote", sourceVersion };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ficecal:catalog-loader] remote catalog load failed (${msg}); falling back to bundled fixture`,
      );
    }
  }

  // ── Bundled fixture ────────────────────────────────────────────────────────
  const raw  = readFileSync(BUNDLED_FIXTURE_PATH, "utf-8");
  const json = JSON.parse(raw) as unknown;
  const catalog = validateCatalog(json);
  const sourceVersion = deriveSourceVersion(catalog);
  if (process.env["NODE_ENV"] !== "test") {
    console.log(
      `[ficecal:catalog-loader] loaded ${catalog.length} entries from bundled fixture (${sourceVersion})`,
    );
  }
  return { catalog, source: "fixture", sourceVersion };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Light structural validation — ensures array of objects with required fields. */
function validateCatalog(raw: unknown): ModelPricingReference[] {
  if (!Array.isArray(raw)) {
    throw new Error("Catalog must be a JSON array");
  }
  for (const entry of raw) {
    if (
      typeof entry !== "object" || entry === null ||
      typeof (entry as Record<string, unknown>)["modelId"] !== "string" ||
      typeof (entry as Record<string, unknown>)["inputTokenCost"] !== "number" ||
      typeof (entry as Record<string, unknown>)["outputTokenCost"] !== "number"
    ) {
      throw new Error(
        `Invalid catalog entry: ${JSON.stringify(entry).slice(0, 120)}`,
      );
    }
  }
  return raw as ModelPricingReference[];
}

/** Derives a version label from the first entry's sourceVersion field. */
function deriveSourceVersion(catalog: ModelPricingReference[]): string {
  return catalog[0]?.sourceVersion ?? "unknown";
}
