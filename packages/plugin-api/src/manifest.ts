// ─── FicecalPluginManifest ─────────────────────────────────────────────────────
//
// Phase 10B P6: canonical manifest file (ficecal-plugin.json) for FiceCal plugins.
// Community plugins must include this file. PluginHost validates it at registration.

export interface FicecalPluginManifest {
  /** npm-style scoped ID, e.g. "@acme/ficecal-plugin-datadog" */
  id: string;
  name: string;
  version: string;         // semver
  description?: string;
  author?: string;
  /** Minimum FiceCal version required, e.g. "2.0.0" */
  minFicecalVersion?: string;
  /** Contribution types this plugin provides */
  contributions: Array<"billing" | "theme" | "mcp" | "hook">;
  stability: "alpha" | "beta" | "stable";
  /** HTTPS URL to the pre-built ESM bundle (required for community plugins) */
  bundleUrl?: string;
  /** Hex-encoded SHA-256 of the bundle for verification */
  sha256?: string;
  /** Signing key identifier (reserved for future GPG / code-signing) */
  signingKey?: string;
  /** ISO date when the manifest was generated */
  createdAt?: string;
}

export class ManifestValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`Manifest validation failed on field "${field}": ${reason}`);
    this.name = "ManifestValidationError";
  }
}

const VALID_CONTRIBUTIONS = new Set(["billing", "theme", "mcp", "hook"]);
const VALID_STABILITY = new Set(["alpha", "beta", "stable"]);
const SCOPED_ID_REGEX = /^@[\w-]+\/[\w-]+$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+/;
const SHA256_REGEX = /^[0-9a-f]{64}$/i;

/** Type guard: validates that manifest has all required fields with correct types.
 *  Throws ManifestValidationError on first failure. */
export function validatePluginManifest(manifest: unknown): asserts manifest is FicecalPluginManifest {
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new ManifestValidationError("manifest", "must be a non-null object");
  }

  const m = manifest as Record<string, unknown>;

  // id
  if (typeof m["id"] !== "string" || m["id"].length === 0) {
    throw new ManifestValidationError("id", "must be a non-empty string");
  }
  if (m["id"].startsWith("@") && !SCOPED_ID_REGEX.test(m["id"])) {
    throw new ManifestValidationError("id", `scoped id must match @scope/name pattern, got "${m["id"]}"`);
  }

  // name
  if (typeof m["name"] !== "string" || m["name"].length === 0) {
    throw new ManifestValidationError("name", "must be a non-empty string");
  }

  // version
  if (typeof m["version"] !== "string" || !SEMVER_REGEX.test(m["version"])) {
    throw new ManifestValidationError("version", "must match semver format (e.g. 1.2.3)");
  }

  // contributions
  if (!Array.isArray(m["contributions"]) || m["contributions"].length === 0) {
    throw new ManifestValidationError("contributions", "must be a non-empty array");
  }
  for (const c of m["contributions"] as unknown[]) {
    if (!VALID_CONTRIBUTIONS.has(c as string)) {
      throw new ManifestValidationError(
        "contributions",
        `invalid contribution type "${String(c)}"; must be one of billing|theme|mcp|hook`,
      );
    }
  }

  // stability
  if (!VALID_STABILITY.has(m["stability"] as string)) {
    throw new ManifestValidationError(
      "stability",
      `must be one of alpha|beta|stable, got "${String(m["stability"])}"`,
    );
  }

  // bundleUrl (optional)
  if (m["bundleUrl"] !== undefined) {
    if (typeof m["bundleUrl"] !== "string" || !m["bundleUrl"].startsWith("https://")) {
      throw new ManifestValidationError("bundleUrl", "must start with https://");
    }
  }

  // sha256 (optional)
  if (m["sha256"] !== undefined) {
    if (typeof m["sha256"] !== "string" || !SHA256_REGEX.test(m["sha256"])) {
      throw new ManifestValidationError(
        "sha256",
        "must be exactly 64 hexadecimal characters",
      );
    }
  }
}

/** Verify a bundle's SHA-256 hash against an expected hex string.
 *  Uses Web Crypto API (SubtleCrypto). Works in both browser and Node 18+.
 *  Returns true if the hash matches. */
export async function verifyBundleHash(
  bundle: string | ArrayBuffer | Uint8Array,
  expectedSha256: string,
): Promise<boolean> {
  let buffer: ArrayBuffer;

  if (typeof bundle === "string") {
    buffer = new TextEncoder().encode(bundle).buffer;
  } else if (bundle instanceof Uint8Array) {
    buffer = bundle.buffer.slice(bundle.byteOffset, bundle.byteOffset + bundle.byteLength);
  } else {
    buffer = bundle;
  }

  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex.toLowerCase() === expectedSha256.toLowerCase();
}

// ─── PluginLockFile ────────────────────────────────────────────────────────────
//
// ficecal-plugin-lock.json — version pinning for installed plugins.
// Prevents silent upgrades from breaking a workspace.

export interface PluginLockEntry {
  id: string;
  version: string;
  bundleSha256: string;
  installedAt: string;  // ISO date
  source: "registry" | "local" | "manual";
}

export interface PluginLockFile {
  ficecalVersion: string;
  generatedAt: string;    // ISO date
  plugins: PluginLockEntry[];
}

/** Create an empty lock file for the given ficecalVersion. */
export function createLockFile(ficecalVersion: string): PluginLockFile {
  return {
    ficecalVersion,
    generatedAt: new Date().toISOString(),
    plugins: [],
  };
}

/** Add or update an entry in the lock file. Returns a new PluginLockFile (immutable). */
export function upsertLockEntry(lockFile: PluginLockFile, entry: PluginLockEntry): PluginLockFile {
  const existing = lockFile.plugins.findIndex((p) => p.id === entry.id);
  const plugins =
    existing === -1
      ? [...lockFile.plugins, entry]
      : lockFile.plugins.map((p, i) => (i === existing ? entry : p));

  return { ...lockFile, plugins };
}

/** Remove a plugin from the lock file by ID. Returns a new PluginLockFile (immutable). */
export function removeLockEntry(lockFile: PluginLockFile, pluginId: string): PluginLockFile {
  return {
    ...lockFile,
    plugins: lockFile.plugins.filter((p) => p.id !== pluginId),
  };
}
