// ─── @ficecal/plugin-registry-client ─────────────────────────────────────────
//
// Community plugin registry client for FiceCal v2 Phase 8.
// Zero dependencies — uses the Web Crypto API and fetch.

export {
  RegistryClient,
  DEFAULT_REGISTRY_INDEX_URL,
  FICECAL_VERSION,
  type BrowseOptions,
} from "./registry-client.js";

export {
  sha256Hex,
  verifySha256,
  isValidSha256Hex,
} from "./sha256.js";

export type {
  PluginManifest,
  RegistryIndex,
  FetchOptions,
  VerificationResult,
  InstallReadinessResult,
} from "./types.js";

export {
  RegistryFetchError,
  BundleVerificationError,
} from "./types.js";
