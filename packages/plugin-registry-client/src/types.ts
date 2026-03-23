// ─── Plugin Registry Types ─────────────────────────────────────────────────────
//
// The community plugin registry is hosted at duksh/ficecal-plugin-registry
// on GitHub. The registry index is a JSON file at:
//
//   https://raw.githubusercontent.com/duksh/ficecal-plugin-registry/main/index.json
//
// Each entry in the index describes a community plugin manifest.

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * A single plugin manifest entry in the community registry index.
 *
 * Published by plugin authors and verified by the FiceCal registry CI pipeline.
 * The `bundleUrl` points to a pre-built ESM bundle; `bundleSha256` is the
 * hex-encoded SHA-256 digest of the bundle bytes, used for integrity checking.
 */
export interface PluginManifest {
  /** npm-style unique identifier. E.g. "@acme/ficecal-plugin-datadog". */
  id: string;

  /** Human-readable plugin name. */
  name: string;

  /** Semantic version of the plugin. E.g. "1.2.0". */
  version: string;

  /** One-line description shown in the AdminPanel registry browser. */
  description: string;

  /** Plugin author or organisation name. */
  author: string;

  /** SPDX license identifier. E.g. "MIT", "Apache-2.0". */
  license: string;

  /**
   * URL of the pre-built ESM bundle.
   * Must be an HTTPS URL to a trusted CDN or GitHub releases asset.
   */
  bundleUrl: string;

  /**
   * Hex-encoded SHA-256 digest of the bundle bytes at bundleUrl.
   * Used for integrity verification before the bundle is loaded.
   */
  bundleSha256: string;

  /**
   * Optional homepage or repository URL shown in the registry browser.
   */
  homepageUrl?: string;

  /**
   * Optional list of capability tags for filtering.
   * E.g. ["billing", "aws", "datadog", "theme"].
   */
  tags?: string[];

  /**
   * Minimum FiceCal version required for this plugin.
   * Semver range. E.g. ">=2.0.0".
   */
  minFicecalVersion?: string;

  /**
   * ISO 8601 date when this manifest was published to the registry.
   */
  publishedAt: string;
}

// ---------------------------------------------------------------------------
// Registry index
// ---------------------------------------------------------------------------

/**
 * The full registry index as fetched from GitHub.
 */
export interface RegistryIndex {
  /** Registry format version. Currently "1". */
  version: string;

  /** ISO 8601 timestamp of when the index was last updated. */
  updatedAt: string;

  /** All community plugin manifests. */
  plugins: PluginManifest[];
}

// ---------------------------------------------------------------------------
// Fetch options
// ---------------------------------------------------------------------------

/**
 * Options accepted by RegistryClient methods that perform network I/O.
 */
export interface FetchOptions {
  /**
   * AbortSignal for cancellation support.
   * Pass `AbortSignal.timeout(ms)` for per-request timeouts.
   */
  signal?: AbortSignal;

  /**
   * Override the registry index URL. Useful for testing against a local
   * or staging registry. Defaults to the official GitHub raw URL.
   */
  indexUrl?: string;
}

// ---------------------------------------------------------------------------
// Verification result
// ---------------------------------------------------------------------------

/**
 * Result of a SHA-256 bundle integrity check.
 */
export interface VerificationResult {
  /** Whether the bundle digest matched the manifest's bundleSha256. */
  ok: boolean;

  /** The expected hex digest from the manifest. */
  expectedSha256: string;

  /** The actual hex digest computed from the downloaded bytes. */
  actualSha256: string;

  /** Human-readable status message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Install readiness
// ---------------------------------------------------------------------------

/**
 * Result of an install-readiness check for a single plugin.
 */
export interface InstallReadinessResult {
  /** The plugin manifest being assessed. */
  manifest: PluginManifest;

  /**
   * Whether the plugin is considered safe to install:
   * - bundleUrl is HTTPS
   * - bundleSha256 looks like a valid hex SHA-256 (64 chars)
   * - minFicecalVersion requirement is met (if specified)
   */
  ready: boolean;

  /** Reasons why the plugin is NOT ready, if any. */
  issues: string[];
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown when the registry index cannot be fetched or parsed.
 */
export class RegistryFetchError extends Error {
  public readonly url: string;
  public readonly statusCode?: number;

  constructor(message: string, options: { url: string; statusCode?: number }) {
    super(message);
    this.name = "RegistryFetchError";
    this.url = options.url;
    this.statusCode = options.statusCode;
  }
}

/**
 * Thrown when SHA-256 verification fails for a bundle download.
 */
export class BundleVerificationError extends Error {
  public readonly pluginId: string;
  public readonly expected: string;
  public readonly actual: string;

  constructor(message: string, options: { pluginId: string; expected: string; actual: string }) {
    super(message);
    this.name = "BundleVerificationError";
    this.pluginId = options.pluginId;
    this.expected = options.expected;
    this.actual = options.actual;
  }
}
