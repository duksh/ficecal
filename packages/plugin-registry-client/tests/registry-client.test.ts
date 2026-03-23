// ─── RegistryClient Tests ─────────────────────────────────────────────────────
//
// Uses vitest's vi.stubGlobal to mock fetch and crypto.subtle so all tests
// run deterministically with no network I/O.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RegistryClient,
  DEFAULT_REGISTRY_INDEX_URL,
  FICECAL_VERSION,
  RegistryFetchError,
  BundleVerificationError,
  isValidSha256Hex,
  sha256Hex,
  verifySha256,
} from "../src/index.js";
import type { PluginManifest, RegistryIndex } from "../src/index.js";

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const MOCK_SHA256 = "a".repeat(64); // 64 hex chars — valid format
const MOCK_SHA256_B = "b".repeat(64);

const PLUGIN_AWS: PluginManifest = {
  id: "@acme/ficecal-plugin-aws-cost-explorer",
  name: "AWS Cost Explorer Plugin",
  version: "1.0.0",
  description: "Live AWS Cost Explorer billing adapter",
  author: "Acme Corp",
  license: "MIT",
  bundleUrl: "https://cdn.acme.com/ficecal/aws-plugin-1.0.0.js",
  bundleSha256: MOCK_SHA256,
  tags: ["aws", "billing", "live"],
  minFicecalVersion: ">=2.0.0",
  publishedAt: "2026-02-01T00:00:00Z",
};

const PLUGIN_DATADOG: PluginManifest = {
  id: "@acme/ficecal-plugin-datadog",
  name: "Datadog Observability Plugin",
  version: "0.8.0",
  description: "Integrates Datadog APM cost data with FiceCal",
  author: "Acme Corp",
  license: "Apache-2.0",
  bundleUrl: "https://cdn.acme.com/ficecal/datadog-plugin-0.8.0.js",
  bundleSha256: MOCK_SHA256_B,
  tags: ["observability", "datadog"],
  publishedAt: "2026-01-15T00:00:00Z",
};

const PLUGIN_THEME: PluginManifest = {
  id: "@community/ficecal-theme-ocean",
  name: "Ocean Theme",
  version: "1.1.0",
  description: "A calming ocean-blue theme for FiceCal",
  author: "Community Dev",
  license: "MIT",
  bundleUrl: "https://cdn.community.dev/themes/ocean-1.1.0.js",
  bundleSha256: MOCK_SHA256,
  tags: ["theme"],
  publishedAt: "2026-01-20T00:00:00Z",
};

const MOCK_INDEX: RegistryIndex = {
  version: "1",
  updatedAt: "2026-02-01T12:00:00Z",
  plugins: [PLUGIN_AWS, PLUGIN_DATADOG, PLUGIN_THEME],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock Response that returns the given JSON payload. */
function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a mock Response that returns the given ArrayBuffer. */
function mockBinaryResponse(buffer: ArrayBuffer, status = 200): Response {
  return new Response(buffer, { status });
}

/** Create an ArrayBuffer filled with repeated byte value. */
function filledBuffer(byteValue: number, length = 16): ArrayBuffer {
  const arr = new Uint8Array(length);
  arr.fill(byteValue);
  return arr.buffer;
}

// ─── sha256 utilities ─────────────────────────────────────────────────────────

describe("isValidSha256Hex", () => {
  it("returns true for 64 lowercase hex chars", () => {
    expect(isValidSha256Hex("a".repeat(64))).toBe(true);
  });

  it("returns true for mixed-case hex", () => {
    expect(isValidSha256Hex("A".repeat(64))).toBe(true);
  });

  it("returns false for 63 chars", () => {
    expect(isValidSha256Hex("a".repeat(63))).toBe(false);
  });

  it("returns false for 65 chars", () => {
    expect(isValidSha256Hex("a".repeat(65))).toBe(false);
  });

  it("returns false for non-hex characters", () => {
    expect(isValidSha256Hex("g".repeat(64))).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidSha256Hex("")).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("returns a 64-char hex string", async () => {
    const buf = filledBuffer(0xab, 32);
    const hex = await sha256Hex(buf);
    expect(hex).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true);
  });

  it("returns the same value for the same input", async () => {
    const buf = filledBuffer(0xff, 64);
    const hex1 = await sha256Hex(buf);
    const hex2 = await sha256Hex(buf);
    expect(hex1).toBe(hex2);
  });

  it("returns different values for different inputs", async () => {
    const buf1 = filledBuffer(0x01);
    const buf2 = filledBuffer(0x02);
    const hex1 = await sha256Hex(buf1);
    const hex2 = await sha256Hex(buf2);
    expect(hex1).not.toBe(hex2);
  });
});

describe("verifySha256", () => {
  it("returns true when digest matches", async () => {
    const buf = filledBuffer(0xab);
    const expected = await sha256Hex(buf);
    expect(await verifySha256(buf, expected)).toBe(true);
  });

  it("returns false when digest does not match", async () => {
    const buf = filledBuffer(0xab);
    expect(await verifySha256(buf, "0".repeat(64))).toBe(false);
  });

  it("is case-insensitive", async () => {
    const buf = filledBuffer(0xcd);
    const expected = await sha256Hex(buf);
    expect(await verifySha256(buf, expected.toUpperCase())).toBe(true);
  });
});

// ─── RegistryClient constants ──────────────────────────────────────────────────

describe("constants", () => {
  it("DEFAULT_REGISTRY_INDEX_URL points to GitHub raw", () => {
    expect(DEFAULT_REGISTRY_INDEX_URL).toContain("raw.githubusercontent.com");
    expect(DEFAULT_REGISTRY_INDEX_URL).toContain("ficecal-plugin-registry");
  });

  it("FICECAL_VERSION is a semver string", () => {
    expect(/^\d+\.\d+\.\d+$/.test(FICECAL_VERSION)).toBe(true);
  });
});

// ─── RegistryClient.getIndex ───────────────────────────────────────────────────

describe("RegistryClient.getIndex", () => {
  let client: RegistryClient;

  beforeEach(() => {
    client = new RegistryClient();
  });

  it("fetches the registry index and returns it", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    );
    vi.stubGlobal("fetch", fetchMock);

    const index = await client.getIndex();
    expect(index.version).toBe("1");
    expect(index.plugins).toHaveLength(3);

    vi.unstubAllGlobals();
  });

  it("caches the result — fetch called only once on second call", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    );
    vi.stubGlobal("fetch", fetchMock);

    await client.getIndex();
    await client.getIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("uses the default index URL", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    );
    vi.stubGlobal("fetch", fetchMock);

    await client.getIndex();
    expect(fetchMock).toHaveBeenCalledWith(DEFAULT_REGISTRY_INDEX_URL, expect.any(Object));

    vi.unstubAllGlobals();
  });

  it("uses a custom indexUrl from FetchOptions", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    );
    vi.stubGlobal("fetch", fetchMock);

    const customUrl = "https://example.com/registry.json";
    await client.getIndex({ indexUrl: customUrl });
    expect(fetchMock).toHaveBeenCalledWith(customUrl, expect.any(Object));

    vi.unstubAllGlobals();
  });

  it("throws RegistryFetchError on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("not found", { status: 404 })
    ));

    await expect(client.getIndex()).rejects.toBeInstanceOf(RegistryFetchError);
    vi.unstubAllGlobals();
  });

  it("RegistryFetchError carries statusCode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("server error", { status: 503 })
    ));

    try {
      await client.getIndex();
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as RegistryFetchError).statusCode).toBe(503);
    }
    vi.unstubAllGlobals();
  });

  it("throws RegistryFetchError when fetch rejects (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(client.getIndex()).rejects.toBeInstanceOf(RegistryFetchError);
    vi.unstubAllGlobals();
  });

  it("throws RegistryFetchError for malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("not json {{{", { status: 200 })
    ));

    await expect(client.getIndex()).rejects.toBeInstanceOf(RegistryFetchError);
    vi.unstubAllGlobals();
  });

  it("throws RegistryFetchError for JSON with wrong shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      mockJsonResponse({ wrong: "shape" })
    ));

    await expect(client.getIndex()).rejects.toBeInstanceOf(RegistryFetchError);
    vi.unstubAllGlobals();
  });
});

// ─── RegistryClient.refresh ───────────────────────────────────────────────────

describe("RegistryClient.refresh", () => {
  it("re-fetches even when cache is populated", async () => {
    const client = new RegistryClient();
    // Use mockImplementation so each call gets a fresh Response (body can only be read once)
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    );
    vi.stubGlobal("fetch", fetchMock);

    await client.getIndex();
    await client.refresh();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("returns updated index after refresh", async () => {
    const client = new RegistryClient();
    const updatedIndex: RegistryIndex = { ...MOCK_INDEX, updatedAt: "2026-03-01T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => Promise.resolve(mockJsonResponse(MOCK_INDEX)))
      .mockImplementationOnce(() => Promise.resolve(mockJsonResponse(updatedIndex)))
    );

    await client.getIndex();
    const refreshed = await client.refresh();
    expect(refreshed.updatedAt).toBe("2026-03-01T00:00:00Z");

    vi.unstubAllGlobals();
  });
});

// ─── RegistryClient.browse ────────────────────────────────────────────────────

describe("RegistryClient.browse", () => {
  let client: RegistryClient;

  beforeEach(() => {
    client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    ));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns all plugins when no filter specified", async () => {
    const results = await client.browse();
    expect(results).toHaveLength(3);
  });

  it("filters by tag (case-insensitive)", async () => {
    const results = await client.browse({ tag: "billing" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(PLUGIN_AWS.id);
  });

  it("filters by tag 'theme'", async () => {
    const results = await client.browse({ tag: "theme" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(PLUGIN_THEME.id);
  });

  it("tag filter is case-insensitive", async () => {
    const results = await client.browse({ tag: "AWS" });
    expect(results).toHaveLength(1);
  });

  it("filters by search term in name", async () => {
    const results = await client.browse({ search: "Ocean" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(PLUGIN_THEME.id);
  });

  it("filters by search term in description", async () => {
    const results = await client.browse({ search: "cost explorer" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(PLUGIN_AWS.id);
  });

  it("filters by search term in author", async () => {
    const results = await client.browse({ search: "community dev" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(PLUGIN_THEME.id);
  });

  it("search returns empty array for no matches", async () => {
    const results = await client.browse({ search: "no-match-xyz" });
    expect(results).toHaveLength(0);
  });

  it("respects limit", async () => {
    const results = await client.browse({}, {});
    expect(results.length).toBe(3);

    const limited = await client.browse({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it("sorts newest first by publishedAt", async () => {
    const results = await client.browse();
    const dates = results.map((p) => new Date(p.publishedAt).getTime());
    expect(dates[0]!).toBeGreaterThanOrEqual(dates[1]!);
    expect(dates[1]!).toBeGreaterThanOrEqual(dates[2]!);
  });

  it("can combine tag and search filters", async () => {
    const results = await client.browse({ tag: "aws", search: "cost" });
    expect(results).toHaveLength(1);
  });
});

// ─── RegistryClient.find ──────────────────────────────────────────────────────

describe("RegistryClient.find", () => {
  let client: RegistryClient;

  beforeEach(() => {
    client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    ));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("finds a plugin by exact id", async () => {
    const plugin = await client.find(PLUGIN_AWS.id);
    expect(plugin).toBeDefined();
    expect(plugin!.name).toBe(PLUGIN_AWS.name);
  });

  it("returns undefined for unknown id", async () => {
    const plugin = await client.find("@unknown/not-a-plugin");
    expect(plugin).toBeUndefined();
  });
});

// ─── RegistryClient.listTags ──────────────────────────────────────────────────

describe("RegistryClient.listTags", () => {
  it("returns sorted unique tags", async () => {
    const client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    ));

    const tags = await client.listTags();
    expect(tags).toEqual([...tags].sort());
    expect(new Set(tags).size).toBe(tags.length); // unique
    expect(tags).toContain("aws");
    expect(tags).toContain("theme");
    expect(tags).toContain("billing");

    vi.unstubAllGlobals();
  });
});

// ─── RegistryClient cache state ───────────────────────────────────────────────

describe("RegistryClient cache state", () => {
  it("isCached is false before first fetch", () => {
    const client = new RegistryClient();
    expect(client.isCached).toBe(false);
  });

  it("isCached is true after fetch", async () => {
    const client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    ));
    await client.getIndex();
    expect(client.isCached).toBe(true);
    vi.unstubAllGlobals();
  });

  it("cachedCount is null before fetch", () => {
    expect(new RegistryClient().cachedCount).toBeNull();
  });

  it("cachedCount is correct after fetch", async () => {
    const client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    ));
    await client.getIndex();
    expect(client.cachedCount).toBe(3);
    vi.unstubAllGlobals();
  });
});

// ─── RegistryClient.verifyBundle ──────────────────────────────────────────────

describe("RegistryClient.verifyBundle", () => {
  it("returns ok=true when bundle digest matches", async () => {
    const client = new RegistryClient();
    const buf = filledBuffer(0xaa, 32);
    const correctSha = await sha256Hex(buf);
    const manifest: PluginManifest = { ...PLUGIN_AWS, bundleSha256: correctSha };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockBinaryResponse(buf)));

    const result = await client.verifyBundle(manifest);
    expect(result.ok).toBe(true);
    expect(result.expectedSha256).toBe(correctSha);
    expect(result.actualSha256).toBe(correctSha);

    vi.unstubAllGlobals();
  });

  it("throws BundleVerificationError when digest mismatches", async () => {
    const client = new RegistryClient();
    const buf = filledBuffer(0xbb, 32);
    const wrongSha = "0".repeat(64);
    const manifest: PluginManifest = { ...PLUGIN_AWS, bundleSha256: wrongSha };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockBinaryResponse(buf)));

    await expect(client.verifyBundle(manifest)).rejects.toBeInstanceOf(BundleVerificationError);
    vi.unstubAllGlobals();
  });

  it("BundleVerificationError carries expected and actual sha", async () => {
    const client = new RegistryClient();
    const buf = filledBuffer(0xcc, 32);
    const actualSha = await sha256Hex(buf);
    const wrongSha = "d".repeat(64);
    const manifest: PluginManifest = { ...PLUGIN_AWS, bundleSha256: wrongSha };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockBinaryResponse(buf)));

    try {
      await client.verifyBundle(manifest);
      expect.fail("should have thrown");
    } catch (err) {
      const e = err as BundleVerificationError;
      expect(e.expected).toBe(wrongSha);
      expect(e.actual).toBe(actualSha);
      expect(e.pluginId).toBe(PLUGIN_AWS.id);
    }
    vi.unstubAllGlobals();
  });

  it("throws RegistryFetchError on bundle download failure", async () => {
    const client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("not found", { status: 404 })
    ));

    await expect(client.verifyBundle(PLUGIN_AWS)).rejects.toBeInstanceOf(RegistryFetchError);
    vi.unstubAllGlobals();
  });

  it("throws RegistryFetchError when fetch rejects", async () => {
    const client = new RegistryClient();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed to fetch")));

    await expect(client.verifyBundle(PLUGIN_AWS)).rejects.toBeInstanceOf(RegistryFetchError);
    vi.unstubAllGlobals();
  });
});

// ─── RegistryClient.checkReadiness ────────────────────────────────────────────

describe("RegistryClient.checkReadiness", () => {
  const client = new RegistryClient();

  it("returns ready=true for a valid manifest", () => {
    const result = client.checkReadiness(PLUGIN_AWS);
    expect(result.ready).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns ready=false for HTTP bundleUrl", () => {
    const manifest: PluginManifest = {
      ...PLUGIN_AWS,
      bundleUrl: "http://insecure.com/plugin.js",
    };
    const result = client.checkReadiness(manifest);
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("HTTPS"))).toBe(true);
  });

  it("returns ready=false for invalid bundleSha256", () => {
    const manifest: PluginManifest = {
      ...PLUGIN_AWS,
      bundleSha256: "not-a-sha256",
    };
    const result = client.checkReadiness(manifest);
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("SHA-256"))).toBe(true);
  });

  it("returns ready=false when minFicecalVersion not met", () => {
    const manifest: PluginManifest = {
      ...PLUGIN_AWS,
      minFicecalVersion: ">=99.0.0",
    };
    const result = client.checkReadiness(manifest, "2.0.0");
    expect(result.ready).toBe(false);
    expect(result.issues.some((i) => i.includes("99.0.0"))).toBe(true);
  });

  it("returns ready=true when minFicecalVersion is met (exact)", () => {
    const manifest: PluginManifest = {
      ...PLUGIN_AWS,
      minFicecalVersion: "2.0.0",
    };
    const result = client.checkReadiness(manifest, "2.0.0");
    expect(result.ready).toBe(true);
  });

  it("returns ready=true when minFicecalVersion is met (>=)", () => {
    const manifest: PluginManifest = {
      ...PLUGIN_AWS,
      minFicecalVersion: ">=2.0.0",
    };
    const result = client.checkReadiness(manifest, "2.1.0");
    expect(result.ready).toBe(true);
  });

  it("accumulates multiple issues", () => {
    const manifest: PluginManifest = {
      ...PLUGIN_AWS,
      bundleUrl: "http://insecure.com/plugin.js",
      bundleSha256: "bad",
    };
    const result = client.checkReadiness(manifest);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("carries the manifest in the result", () => {
    const result = client.checkReadiness(PLUGIN_AWS);
    expect(result.manifest.id).toBe(PLUGIN_AWS.id);
  });

  it("ready=true for plugin with no minFicecalVersion", () => {
    const manifest: PluginManifest = { ...PLUGIN_DATADOG }; // no minFicecalVersion
    const result = client.checkReadiness(manifest);
    expect(result.ready).toBe(true);
  });
});

// ─── Error class structure ─────────────────────────────────────────────────────

describe("RegistryFetchError", () => {
  it("is an instance of Error", () => {
    const err = new RegistryFetchError("msg", { url: "https://x.com" });
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new RegistryFetchError("msg", { url: "https://x.com" });
    expect(err.name).toBe("RegistryFetchError");
  });

  it("stores url and statusCode", () => {
    const err = new RegistryFetchError("msg", { url: "https://x.com", statusCode: 404 });
    expect(err.url).toBe("https://x.com");
    expect(err.statusCode).toBe(404);
  });
});

describe("BundleVerificationError", () => {
  it("is an instance of Error", () => {
    const err = new BundleVerificationError("msg", {
      pluginId: "x",
      expected: "a".repeat(64),
      actual: "b".repeat(64),
    });
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new BundleVerificationError("msg", {
      pluginId: "x",
      expected: "a".repeat(64),
      actual: "b".repeat(64),
    });
    expect(err.name).toBe("BundleVerificationError");
  });
});

// ─── RegistryClient custom indexUrl constructor ───────────────────────────────

describe("RegistryClient constructor", () => {
  it("uses custom indexUrl from constructor", async () => {
    const customUrl = "https://example.com/custom-registry.json";
    const client = new RegistryClient({ indexUrl: customUrl });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(mockJsonResponse(MOCK_INDEX))
    );
    vi.stubGlobal("fetch", fetchMock);

    await client.getIndex();
    expect(fetchMock).toHaveBeenCalledWith(customUrl, expect.any(Object));

    vi.unstubAllGlobals();
  });
});

