import { describe, it, expect } from "vitest";
import {
  validatePluginManifest,
  ManifestValidationError,
  verifyBundleHash,
  createLockFile,
  upsertLockEntry,
  removeLockEntry,
} from "../src/manifest.js";
import type { FicecalPluginManifest, PluginLockEntry } from "../src/manifest.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validManifest(overrides: Partial<FicecalPluginManifest> = {}): unknown {
  return {
    id: "my-plugin",
    name: "My Plugin",
    version: "1.0.0",
    contributions: ["billing"],
    stability: "stable",
    ...overrides,
  };
}

const REAL_SHA256 = "a".repeat(64); // 64 hex chars (all 'a')

function makeLockEntry(overrides: Partial<PluginLockEntry> = {}): PluginLockEntry {
  return {
    id: "my-plugin",
    version: "1.0.0",
    bundleSha256: REAL_SHA256,
    installedAt: new Date().toISOString(),
    source: "registry",
    ...overrides,
  };
}

// ─── validatePluginManifest ───────────────────────────────────────────────────

describe("validatePluginManifest", () => {
  it("accepts a valid manifest", () => {
    expect(() => validatePluginManifest(validManifest())).not.toThrow();
  });

  it("accepts scoped @scope/name id", () => {
    expect(() => validatePluginManifest(validManifest({ id: "@acme/ficecal-plugin-datadog" }))).not.toThrow();
  });

  it("rejects non-object input", () => {
    expect(() => validatePluginManifest("not-an-object")).toThrow(ManifestValidationError);
    expect(() => validatePluginManifest(null)).toThrow(ManifestValidationError);
    expect(() => validatePluginManifest(42)).toThrow(ManifestValidationError);
    expect(() => validatePluginManifest([])).toThrow(ManifestValidationError);
  });

  it("rejects empty id", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ id: "" })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("id");
  });

  it("rejects scoped id with invalid format", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ id: "@bad" })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("id");
  });

  it("rejects missing name", () => {
    const m = validManifest() as Record<string, unknown>;
    delete m["name"];
    expect(() => validatePluginManifest(m)).toThrow(ManifestValidationError);
  });

  it("rejects empty name", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ name: "" })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("name");
  });

  it("rejects invalid version format", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ version: "not-a-version" })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("version");
  });

  it("rejects empty contributions array", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ contributions: [] })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("contributions");
  });

  it("rejects invalid contribution type", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ contributions: ["billing", "invalid" as never] })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("contributions");
  });

  it("rejects invalid stability value", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ stability: "experimental" as never })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("stability");
  });

  it("rejects http bundleUrl (must be https)", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ bundleUrl: "http://example.com/bundle.js" })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("bundleUrl");
  });

  it("rejects sha256 with wrong length", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ sha256: "abc123" })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("sha256");
  });

  it("rejects sha256 with non-hex characters", () => {
    const err = (() => {
      try { validatePluginManifest(validManifest({ sha256: "z".repeat(64) })); }
      catch (e) { return e; }
    })();
    expect(err).toBeInstanceOf(ManifestValidationError);
    expect((err as ManifestValidationError).field).toBe("sha256");
  });

  it("accepts valid 64-char lowercase sha256", () => {
    expect(() =>
      validatePluginManifest(validManifest({ sha256: "a".repeat(64) })),
    ).not.toThrow();
  });

  it("accepts valid 64-char uppercase SHA256", () => {
    expect(() =>
      validatePluginManifest(validManifest({ sha256: "A".repeat(64) })),
    ).not.toThrow();
  });
});

// ─── ManifestValidationError ──────────────────────────────────────────────────

describe("ManifestValidationError", () => {
  it("has field and reason", () => {
    const err = new ManifestValidationError("version", "must be semver");
    expect(err.field).toBe("version");
    expect(err.reason).toBe("must be semver");
  });

  it("name is ManifestValidationError", () => {
    const err = new ManifestValidationError("id", "invalid");
    expect(err.name).toBe("ManifestValidationError");
  });
});

// ─── verifyBundleHash ─────────────────────────────────────────────────────────

describe("verifyBundleHash", () => {
  // Known SHA-256 of "hello world" (UTF-8)
  const HELLO_WORLD_SHA256 = "b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576e56b77bf36b7c40a";
  // Actual SHA-256: b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576e56b77bf36b7c40a
  // Wait — let's use a known good value computed from Node crypto. We'll use crypto.subtle inline.

  it("verifyBundleHash returns true for correct sha256 (string input)", async () => {
    // Compute sha256 of "test" dynamically so we don't hardcode
    const data = "test-bundle-content";
    const buffer = new TextEncoder().encode(data);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyBundleHash(data, hashHex);
    expect(result).toBe(true);
  });

  it("verifyBundleHash returns false for wrong sha256", async () => {
    const result = await verifyBundleHash("some content", "0".repeat(64));
    expect(result).toBe(false);
  });

  it("verifyBundleHash accepts ArrayBuffer input", async () => {
    const data = "arraybuffer-test";
    const encoded = new TextEncoder().encode(data);
    const buffer: ArrayBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);

    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyBundleHash(buffer, hashHex);
    expect(result).toBe(true);
  });

  it("verifyBundleHash accepts Uint8Array input", async () => {
    const data = "uint8array-test";
    const encoded = new TextEncoder().encode(data);

    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyBundleHash(encoded, hashHex);
    expect(result).toBe(true);
  });
});

// ─── Lock file utilities ──────────────────────────────────────────────────────

describe("createLockFile", () => {
  it("returns empty plugins array", () => {
    const lock = createLockFile("2.0.0");
    expect(lock.plugins).toEqual([]);
    expect(lock.ficecalVersion).toBe("2.0.0");
  });
});

describe("upsertLockEntry", () => {
  it("adds new entry", () => {
    const lock = createLockFile("2.0.0");
    const entry = makeLockEntry();
    const updated = upsertLockEntry(lock, entry);
    expect(updated.plugins).toHaveLength(1);
    expect(updated.plugins[0]).toEqual(entry);
  });

  it("replaces existing entry with same id", () => {
    const lock = createLockFile("2.0.0");
    const entry1 = makeLockEntry({ version: "1.0.0" });
    const entry2 = makeLockEntry({ version: "2.0.0" });
    const updated = upsertLockEntry(upsertLockEntry(lock, entry1), entry2);
    expect(updated.plugins).toHaveLength(1);
    expect(updated.plugins[0]?.version).toBe("2.0.0");
  });

  it("returns new object (immutable)", () => {
    const lock = createLockFile("2.0.0");
    const entry = makeLockEntry();
    const updated = upsertLockEntry(lock, entry);
    expect(updated).not.toBe(lock);
    expect(lock.plugins).toHaveLength(0);
  });
});

describe("removeLockEntry", () => {
  it("removes entry by id", () => {
    const lock = createLockFile("2.0.0");
    const entry = makeLockEntry({ id: "to-remove" });
    const withEntry = upsertLockEntry(lock, entry);
    const removed = removeLockEntry(withEntry, "to-remove");
    expect(removed.plugins).toHaveLength(0);
  });

  it("is a no-op if id not found", () => {
    const lock = createLockFile("2.0.0");
    const entry = makeLockEntry({ id: "exists" });
    const withEntry = upsertLockEntry(lock, entry);
    const result = removeLockEntry(withEntry, "does-not-exist");
    expect(result.plugins).toHaveLength(1);
  });
});
