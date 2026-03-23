// ─── RegistryClient ────────────────────────────────────────────────────────────
//
// Fetches the FiceCal community plugin registry index from GitHub, providing:
//   - browse()          : List all plugins, with optional tag/keyword filtering
//   - find()            : Look up a single plugin by id
//   - refresh()         : Re-fetch the index (clears in-memory cache)
//   - verifyBundle()    : Download a bundle and verify its SHA-256 digest
//   - checkReadiness()  : Assess whether a plugin is safe to install
//
// The index is cached in-memory after the first successful fetch. Call refresh()
// to force a re-fetch (e.g. after user explicitly requests "check for updates").

import { sha256Hex, verifySha256, isValidSha256Hex } from "./sha256.js";
import {
  RegistryFetchError,
  BundleVerificationError,
  type PluginManifest,
  type RegistryIndex,
  type FetchOptions,
  type VerificationResult,
  type InstallReadinessResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default URL for the FiceCal community plugin registry index. */
export const DEFAULT_REGISTRY_INDEX_URL =
  "https://raw.githubusercontent.com/duksh/ficecal-plugin-registry/main/plugins/index.json";

/** Minimum FiceCal version this client operates against. */
export const FICECAL_VERSION = "2.0.0";

// ---------------------------------------------------------------------------
// Browse options
// ---------------------------------------------------------------------------

/**
 * Options for the browse() method.
 */
export interface BrowseOptions {
  /** Filter by tag — plugin must include this tag in its `tags` array. */
  tag?: string;

  /**
   * Full-text search across id, name, description, and author.
   * Case-insensitive substring match.
   */
  search?: string;

  /**
   * Maximum number of results to return. Returns all if omitted.
   */
  limit?: number;
}

// ---------------------------------------------------------------------------
// RegistryClient
// ---------------------------------------------------------------------------

/**
 * Client for the FiceCal community plugin registry.
 *
 * @example
 * ```ts
 * const client = new RegistryClient();
 * const billingPlugins = await client.browse({ tag: "billing" });
 * const plugin = await client.find("@acme/ficecal-plugin-datadog");
 * const result = await client.verifyBundle(plugin);
 * ```
 */
export class RegistryClient {
  private _cache: RegistryIndex | null = null;
  private readonly _defaultIndexUrl: string;

  constructor(options: { indexUrl?: string } = {}) {
    this._defaultIndexUrl = options.indexUrl ?? DEFAULT_REGISTRY_INDEX_URL;
  }

  // ── Index fetching ──────────────────────────────────────────────────────────

  /**
   * Returns the registry index, fetching it if not yet cached.
   * Subsequent calls return the in-memory cache until refresh() is called.
   */
  async getIndex(options: FetchOptions = {}): Promise<RegistryIndex> {
    if (this._cache !== null) return this._cache;
    return this._fetchIndex(options);
  }

  /**
   * Forces a re-fetch of the registry index, replacing the cache.
   * Use when the user explicitly requests "check for updates".
   */
  async refresh(options: FetchOptions = {}): Promise<RegistryIndex> {
    this._cache = null;
    return this._fetchIndex(options);
  }

  // ── Browsing ────────────────────────────────────────────────────────────────

  /**
   * Returns all plugins in the registry, optionally filtered by tag or search term.
   * Results are sorted by publishedAt descending (newest first).
   */
  async browse(
    browseOptions: BrowseOptions = {},
    fetchOptions: FetchOptions = {}
  ): Promise<PluginManifest[]> {
    const index = await this.getIndex(fetchOptions);
    let results = [...index.plugins];

    // Tag filter
    if (browseOptions.tag) {
      const tag = browseOptions.tag.toLowerCase();
      results = results.filter((p) =>
        p.tags?.some((t) => t.toLowerCase() === tag)
      );
    }

    // Full-text search
    if (browseOptions.search) {
      const needle = browseOptions.search.toLowerCase();
      results = results.filter(
        (p) =>
          p.id.toLowerCase().includes(needle) ||
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle) ||
          p.author.toLowerCase().includes(needle)
      );
    }

    // Sort newest first
    results.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Limit
    if (browseOptions.limit !== undefined) {
      results = results.slice(0, browseOptions.limit);
    }

    return results;
  }

  /**
   * Finds a single plugin by exact id.
   * Returns undefined if not found.
   */
  async find(
    pluginId: string,
    fetchOptions: FetchOptions = {}
  ): Promise<PluginManifest | undefined> {
    const index = await this.getIndex(fetchOptions);
    return index.plugins.find((p) => p.id === pluginId);
  }

  /**
   * Returns all unique tags across all plugins in the registry.
   * Sorted alphabetically.
   */
  async listTags(fetchOptions: FetchOptions = {}): Promise<string[]> {
    const index = await this.getIndex(fetchOptions);
    const tagSet = new Set<string>();
    for (const plugin of index.plugins) {
      for (const tag of plugin.tags ?? []) {
        tagSet.add(tag.toLowerCase());
      }
    }
    return [...tagSet].sort();
  }

  // ── Bundle verification ─────────────────────────────────────────────────────

  /**
   * Downloads the plugin bundle from bundleUrl and verifies its SHA-256 digest
   * against the manifest's bundleSha256.
   *
   * Throws BundleVerificationError if the digest does not match.
   * Throws RegistryFetchError if the bundle cannot be downloaded.
   *
   * @returns VerificationResult with ok=true on success.
   */
  async verifyBundle(
    manifest: PluginManifest,
    fetchOptions: FetchOptions = {}
  ): Promise<VerificationResult> {
    let response: Response;
    try {
      response = await fetch(manifest.bundleUrl, { signal: fetchOptions.signal });
    } catch (err) {
      throw new RegistryFetchError(
        `Failed to download bundle for "${manifest.id}": ${err instanceof Error ? err.message : String(err)}`,
        { url: manifest.bundleUrl }
      );
    }

    if (!response.ok) {
      throw new RegistryFetchError(
        `Bundle download for "${manifest.id}" returned HTTP ${response.status}`,
        { url: manifest.bundleUrl, statusCode: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const actualSha256 = await sha256Hex(buffer);
    const ok = await verifySha256(buffer, manifest.bundleSha256);

    const result: VerificationResult = {
      ok,
      expectedSha256: manifest.bundleSha256,
      actualSha256,
      message: ok
        ? `Bundle integrity verified for "${manifest.id}"`
        : `SHA-256 mismatch for "${manifest.id}": expected ${manifest.bundleSha256}, got ${actualSha256}`,
    };

    if (!ok) {
      throw new BundleVerificationError(result.message, {
        pluginId: manifest.id,
        expected: manifest.bundleSha256,
        actual: actualSha256,
      });
    }

    return result;
  }

  // ── Install readiness ───────────────────────────────────────────────────────

  /**
   * Assesses whether a plugin is safe to install without downloading the bundle.
   * Checks:
   *   1. bundleUrl is HTTPS
   *   2. bundleSha256 is a valid 64-char hex string
   *   3. minFicecalVersion requirement is met (simple semver check)
   *
   * Does NOT download the bundle — call verifyBundle() for full integrity check.
   */
  checkReadiness(
    manifest: PluginManifest,
    currentVersion: string = FICECAL_VERSION
  ): InstallReadinessResult {
    const issues: string[] = [];

    // 1. HTTPS bundle URL
    if (!manifest.bundleUrl.startsWith("https://")) {
      issues.push(
        `bundleUrl must use HTTPS (got: "${manifest.bundleUrl.slice(0, 30)}...")`
      );
    }

    // 2. Valid SHA-256 hex
    if (!isValidSha256Hex(manifest.bundleSha256)) {
      issues.push(
        `bundleSha256 is not a valid 64-character hex SHA-256 digest`
      );
    }

    // 3. Minimum FiceCal version (simplified semver: parse major.minor.patch)
    if (manifest.minFicecalVersion) {
      const meetsMin = semverSatisfies(currentVersion, manifest.minFicecalVersion);
      if (!meetsMin) {
        issues.push(
          `Requires FiceCal ${manifest.minFicecalVersion} (running ${currentVersion})`
        );
      }
    }

    return {
      manifest,
      ready: issues.length === 0,
      issues,
    };
  }

  /**
   * Returns the number of plugins currently in the cached index.
   * Returns null if the index has not been fetched yet.
   */
  get cachedCount(): number | null {
    return this._cache === null ? null : this._cache.plugins.length;
  }

  /**
   * Returns true if the index is currently cached in memory.
   */
  get isCached(): boolean {
    return this._cache !== null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async _fetchIndex(options: FetchOptions): Promise<RegistryIndex> {
    const url = options.indexUrl ?? this._defaultIndexUrl;
    let response: Response;

    try {
      response = await fetch(url, { signal: options.signal });
    } catch (err) {
      throw new RegistryFetchError(
        `Failed to fetch registry index: ${err instanceof Error ? err.message : String(err)}`,
        { url }
      );
    }

    if (!response.ok) {
      throw new RegistryFetchError(
        `Registry index fetch returned HTTP ${response.status} from ${url}`,
        { url, statusCode: response.status }
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new RegistryFetchError(
        `Registry index response is not valid JSON (from ${url})`,
        { url }
      );
    }

    if (!isRegistryIndex(data)) {
      throw new RegistryFetchError(
        `Registry index has unexpected structure (from ${url})`,
        { url }
      );
    }

    this._cache = data;
    return data;
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isRegistryIndex(value: unknown): value is RegistryIndex {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["version"] === "string" &&
    typeof v["updatedAt"] === "string" &&
    Array.isArray(v["plugins"])
  );
}

// ---------------------------------------------------------------------------
// Simplified semver comparison (major.minor.patch only, no pre-release)
// ---------------------------------------------------------------------------

/**
 * Returns true if `current` satisfies the `range`.
 * Supports ">=X.Y.Z" and "X.Y.Z" (exact match) only.
 * All other range strings are treated as satisfied (fail-open for unknown syntax).
 */
function semverSatisfies(current: string, range: string): boolean {
  const gte = range.startsWith(">=");
  const required = gte ? range.slice(2).trim() : range.trim();

  const [curMaj = 0, curMin = 0, curPat = 0] = required
    ? current.split(".").map(Number)
    : [0, 0, 0];
  const [reqMaj = 0, reqMin = 0, reqPat = 0] = required.split(".").map(Number);

  if (gte) {
    if (curMaj !== reqMaj) return curMaj > reqMaj;
    if (curMin !== reqMin) return curMin > reqMin;
    return curPat >= reqPat;
  }

  // Exact match
  return curMaj === reqMaj && curMin === reqMin && curPat === reqPat;
}
