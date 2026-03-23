import { describe, it, expect } from "vitest";
import { PluginUpdateChecker } from "../src/updater.js";
import type { InstalledPlugin, PluginUpdate } from "../src/updater.js";
import type { RegistryClient } from "@ficecal/plugin-registry-client";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

interface MockManifest {
  id: string;
  version: string;
  bundleUrl: string;
  bundleSha256: string;
  description?: string;
  name: string;
  author: string;
  license: string;
  publishedAt: string;
}

let lastBrowseCallCount = 0;

function makeRegistry(manifests: MockManifest[]): RegistryClient {
  lastBrowseCallCount = 0;
  return {
    browse: async () => {
      lastBrowseCallCount++;
      return manifests;
    },
    find: async (id: string) => manifests.find((m) => m.id === id),
  } as unknown as RegistryClient;
}

function makeManifest(overrides: Partial<MockManifest> = {}): MockManifest {
  return {
    id: "test-plugin",
    version: "2.0.0",
    bundleUrl: "https://cdn.example.com/test-plugin-2.0.0.js",
    bundleSha256: "a".repeat(64),
    name: "Test Plugin",
    author: "Test Author",
    license: "MIT",
    publishedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeInstalled(id: string, version: string): InstalledPlugin {
  return { id, version };
}

// ─── checkForUpdates ──────────────────────────────────────────────────────────

describe("PluginUpdateChecker.checkForUpdates", () => {
  it("returns empty array when no updates available", async () => {
    const registry = makeRegistry([makeManifest({ version: "1.0.0" })]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates).toEqual([]);
  });

  it("returns update when registry has newer version", async () => {
    const registry = makeRegistry([makeManifest({ version: "2.0.0" })]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe("test-plugin");
    expect(updates[0]?.availableVersion).toBe("2.0.0");
    expect(updates[0]?.currentVersion).toBe("1.0.0");
  });

  it("ignores plugins not in registry", async () => {
    const registry = makeRegistry([makeManifest({ id: "other-plugin" })]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates).toEqual([]);
  });

  it("handles multiple installed plugins", async () => {
    const registry = makeRegistry([
      makeManifest({ id: "plugin-a", version: "2.0.0", bundleUrl: "https://cdn.example.com/a.js" }),
      makeManifest({ id: "plugin-b", version: "1.0.0", bundleUrl: "https://cdn.example.com/b.js" }),
      makeManifest({ id: "plugin-c", version: "3.0.0", bundleUrl: "https://cdn.example.com/c.js" }),
    ]);
    const checker = new PluginUpdateChecker(registry);
    const installed = [
      makeInstalled("plugin-a", "1.0.0"),
      makeInstalled("plugin-b", "1.0.0"),
      makeInstalled("plugin-c", "1.0.0"),
    ];
    const updates = await checker.checkForUpdates(installed);
    // plugin-a and plugin-c have updates, plugin-b does not
    expect(updates).toHaveLength(2);
    const ids = updates.map((u) => u.id).sort();
    expect(ids).toEqual(["plugin-a", "plugin-c"]);
  });

  it("returns only plugins with newer version (not same, not older)", async () => {
    const registry = makeRegistry([
      makeManifest({ id: "same", version: "1.0.0", bundleUrl: "https://cdn.example.com/same.js" }),
      makeManifest({ id: "older", version: "0.9.0", bundleUrl: "https://cdn.example.com/older.js" }),
      makeManifest({ id: "newer", version: "2.0.0", bundleUrl: "https://cdn.example.com/newer.js" }),
    ]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([
      makeInstalled("same", "1.0.0"),
      makeInstalled("older", "1.0.0"),
      makeInstalled("newer", "1.0.0"),
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.id).toBe("newer");
  });

  it("maps bundleUrl correctly", async () => {
    const url = "https://cdn.example.com/my-plugin-2.0.0.js";
    const registry = makeRegistry([makeManifest({ version: "2.0.0", bundleUrl: url })]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates[0]?.bundleUrl).toBe(url);
  });

  it("maps bundleSha256 correctly", async () => {
    const sha = "b".repeat(64);
    const registry = makeRegistry([makeManifest({ version: "2.0.0", bundleSha256: sha })]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates[0]?.bundleSha256).toBe(sha);
  });

  it("uses description as releaseNotes when available", async () => {
    const registry = makeRegistry([
      makeManifest({ version: "2.0.0", description: "New feature: dark mode" }),
    ]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates[0]?.releaseNotes).toBe("New feature: dark mode");
  });

  it("sets releaseNotes undefined when description absent", async () => {
    const manifest = makeManifest({ version: "2.0.0" });
    delete manifest.description;
    const registry = makeRegistry([manifest]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]);
    expect(updates[0]?.releaseNotes).toBeUndefined();
  });

  it("calls browse once for multiple plugins", async () => {
    const registry = makeRegistry([
      makeManifest({ id: "p1", version: "2.0.0", bundleUrl: "https://cdn.example.com/p1.js" }),
      makeManifest({ id: "p2", version: "2.0.0", bundleUrl: "https://cdn.example.com/p2.js" }),
    ]);
    const checker = new PluginUpdateChecker(registry);
    await checker.checkForUpdates([
      makeInstalled("p1", "1.0.0"),
      makeInstalled("p2", "1.0.0"),
    ]);
    expect(lastBrowseCallCount).toBe(1);
  });

  it("checkForUpdates propagates browse error", async () => {
    const registry = {
      browse: async () => { throw new Error("network error"); },
      find: async () => undefined,
    } as unknown as RegistryClient;
    const checker = new PluginUpdateChecker(registry);
    await expect(
      checker.checkForUpdates([makeInstalled("test-plugin", "1.0.0")]),
    ).rejects.toThrow("network error");
  });

  it("PluginUpdate has currentVersion and availableVersion", async () => {
    const registry = makeRegistry([makeManifest({ version: "3.1.0" })]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("test-plugin", "1.2.3")]);
    const update = updates[0] as PluginUpdate;
    expect(update.currentVersion).toBe("1.2.3");
    expect(update.availableVersion).toBe("3.1.0");
  });
});

// ─── hasUpdate ────────────────────────────────────────────────────────────────

describe("PluginUpdateChecker.hasUpdate", () => {
  it("returns true when newer version available", async () => {
    const registry = makeRegistry([makeManifest({ version: "2.0.0" })]);
    const checker = new PluginUpdateChecker(registry);
    expect(await checker.hasUpdate("test-plugin", "1.0.0")).toBe(true);
  });

  it("returns false when same version", async () => {
    const registry = makeRegistry([makeManifest({ version: "1.0.0" })]);
    const checker = new PluginUpdateChecker(registry);
    expect(await checker.hasUpdate("test-plugin", "1.0.0")).toBe(false);
  });

  it("returns false when registry has older version", async () => {
    const registry = makeRegistry([makeManifest({ version: "0.9.0" })]);
    const checker = new PluginUpdateChecker(registry);
    expect(await checker.hasUpdate("test-plugin", "1.0.0")).toBe(false);
  });

  it("returns false when plugin not in registry", async () => {
    const registry = makeRegistry([]);
    const checker = new PluginUpdateChecker(registry);
    expect(await checker.hasUpdate("unknown-plugin", "1.0.0")).toBe(false);
  });
});

// ─── Version comparison edge cases ───────────────────────────────────────────

describe("version comparison", () => {
  async function isUpdate(available: string, current: string): Promise<boolean> {
    const registry = makeRegistry([
      makeManifest({ id: "p", version: available, bundleUrl: "https://cdn.example.com/p.js" }),
    ]);
    const checker = new PluginUpdateChecker(registry);
    const updates = await checker.checkForUpdates([makeInstalled("p", current)]);
    return updates.length > 0;
  }

  it("2.0.0 > 1.9.9", async () => {
    expect(await isUpdate("2.0.0", "1.9.9")).toBe(true);
  });

  it("1.10.0 > 1.9.0", async () => {
    expect(await isUpdate("1.10.0", "1.9.0")).toBe(true);
  });

  it("1.0.1 > 1.0.0", async () => {
    expect(await isUpdate("1.0.1", "1.0.0")).toBe(true);
  });

  it("equal versions are not updates", async () => {
    expect(await isUpdate("1.5.3", "1.5.3")).toBe(false);
  });
});
