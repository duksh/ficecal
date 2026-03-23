import { describe, it, expect, vi } from "vitest";
import { WorkspaceRegistry, PluginHost, PluginRegistrationError } from "../src/index.js";
import type { FicecalPlugin, ThemeContribution, BillingAdapterContribution, BillingPeriodSummary, McpToolRegistrar } from "../src/index.js";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeMcpRegistrar(): McpToolRegistrar {
  return { register: () => {} };
}

const lightTheme: ThemeContribution = {
  id: "light",
  displayName: "Light",
  tokens: { "--fc-bg-base": "#ffffff" },
  previewSwatch: "#ffffff",
};

const darkTheme: ThemeContribution = {
  id: "dark",
  displayName: "Dark",
  tokens: { "--fc-bg-base": "#0a0a0f" },
  previewSwatch: "#0a0a0f",
};

const awsSummary: BillingPeriodSummary = {
  provider: "aws",
  billingPeriodStart: "2026-01-01",
  billingPeriodEnd: "2026-02-01",
  totalCost: 1000,
  currency: "USD",
  lineItems: [],
};

const awsAdapter: BillingAdapterContribution = {
  provider: "aws",
  ingestMode: "deterministic",
  async load() { return awsSummary; },
};

function makePlugin(overrides: Partial<FicecalPlugin> = {}): FicecalPlugin {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    contributions: {},
    ...overrides,
  };
}

function makeHostWithPlugins() {
  const host = new PluginHost(makeMcpRegistrar());
  host.register(makePlugin({
    id: "theme-plugin",
    contributions: { themes: [lightTheme, darkTheme] },
  }));
  host.register(makePlugin({
    id: "billing-plugin",
    contributions: { billingAdapters: [awsAdapter] },
  }));
  host.register(makePlugin({ id: "utility-plugin" }));
  return host;
}

// ─── WorkspaceRegistry ─────────────────────────────────────────────────────────

describe("WorkspaceRegistry — construction", () => {
  it("can be constructed with a PluginHost", () => {
    const host = new PluginHost(makeMcpRegistrar());
    const reg = new WorkspaceRegistry(host);
    expect(reg).toBeDefined();
  });

  it("starts with no workspace overrides", () => {
    const reg = new WorkspaceRegistry(new PluginHost(makeMcpRegistrar()));
    expect(reg.listWorkspaces()).toHaveLength(0);
  });
});

describe("WorkspaceRegistry — plugin visibility", () => {
  it("all global plugins are visible to all workspaces by default", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    const plugins = reg.listPluginsForWorkspace("ws-a");
    expect(plugins.map((p) => p.id)).toContain("theme-plugin");
    expect(plugins.map((p) => p.id)).toContain("billing-plugin");
    expect(plugins.map((p) => p.id)).toContain("utility-plugin");
  });

  it("disablePluginForWorkspace hides a plugin from that workspace", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    const ids = reg.listPluginsForWorkspace("ws-a").map((p) => p.id);
    expect(ids).not.toContain("billing-plugin");
    expect(ids).toContain("theme-plugin");
  });

  it("disablePluginForWorkspace does not affect other workspaces", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    const wsB = reg.listPluginsForWorkspace("ws-b").map((p) => p.id);
    expect(wsB).toContain("billing-plugin");
  });

  it("enablePluginForWorkspace re-adds a workspace-disabled plugin", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    reg.enablePluginForWorkspace("ws-a", "billing-plugin");
    const ids = reg.listPluginsForWorkspace("ws-a").map((p) => p.id);
    expect(ids).toContain("billing-plugin");
  });

  it("enablePluginForWorkspace is a no-op if plugin is not workspace-disabled", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    // No disable first — enable should not throw or add spurious state
    expect(() => reg.enablePluginForWorkspace("ws-a", "utility-plugin")).not.toThrow();
    expect(reg.listWorkspaces()).toHaveLength(0); // no override state created
  });

  it("disablePluginForWorkspace is idempotent — fires hook only once per change", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    const spy = vi.fn();
    host.hooks.addAction("workspace.plugin.disabled", spy);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    reg.disablePluginForWorkspace("ws-a", "billing-plugin"); // second call — no-op
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("WorkspaceRegistry — isPluginEnabledForWorkspace", () => {
  it("returns true for a plugin visible to the workspace", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    expect(reg.isPluginEnabledForWorkspace("ws-a", "theme-plugin")).toBe(true);
  });

  it("returns false for a workspace-disabled plugin", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    expect(reg.isPluginEnabledForWorkspace("ws-a", "billing-plugin")).toBe(false);
  });

  it("returns false for a globally-disabled plugin even without workspace override", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    host.disablePlugin("theme-plugin"); // global disable
    expect(reg.isPluginEnabledForWorkspace("ws-a", "theme-plugin")).toBe(false);
    expect(reg.isPluginEnabledForWorkspace("ws-b", "theme-plugin")).toBe(false);
  });

  it("listPluginsForWorkspace excludes globally-disabled plugins", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    host.disablePlugin("utility-plugin");
    const ids = reg.listPluginsForWorkspace("ws-a").map((p) => p.id);
    expect(ids).not.toContain("utility-plugin");
  });
});

describe("WorkspaceRegistry — contribution filtering", () => {
  it("listThemesForWorkspace returns themes from workspace-visible plugins only", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "theme-plugin");
    const themes = reg.listThemesForWorkspace("ws-a");
    expect(themes).toHaveLength(0); // theme-plugin was disabled for ws-a
  });

  it("listThemesForWorkspace returns all themes when no overrides", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    const themes = reg.listThemesForWorkspace("ws-a");
    expect(themes.map((t) => t.id)).toContain("light");
    expect(themes.map((t) => t.id)).toContain("dark");
  });

  it("listAdaptersForWorkspace returns adapters from workspace-visible plugins only", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    expect(reg.listAdaptersForWorkspace("ws-a")).toHaveLength(0);
  });

  it("listAdaptersForWorkspace returns adapters when plugin is visible", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    const adapters = reg.listAdaptersForWorkspace("ws-a");
    expect(adapters.map((a) => a.provider)).toContain("aws");
  });
});

describe("WorkspaceRegistry — workspace management", () => {
  it("resetWorkspace removes all overrides for that workspace", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    reg.disablePluginForWorkspace("ws-a", "utility-plugin");
    expect(reg.overrideCount("ws-a")).toBe(2);
    reg.resetWorkspace("ws-a");
    expect(reg.overrideCount("ws-a")).toBe(0);
    // All plugins visible again
    expect(reg.listPluginsForWorkspace("ws-a")).toHaveLength(3);
  });

  it("resetWorkspace on an unknown workspace is a no-op", () => {
    const reg = new WorkspaceRegistry(new PluginHost(makeMcpRegistrar()));
    expect(() => reg.resetWorkspace("nonexistent")).not.toThrow();
  });

  it("listWorkspaces returns only workspaces with active overrides", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    reg.disablePluginForWorkspace("ws-b", "theme-plugin");
    expect(reg.listWorkspaces()).toContain("ws-a");
    expect(reg.listWorkspaces()).toContain("ws-b");
  });

  it("listWorkspaces cleans up after all plugins re-enabled for a workspace", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-a", "billing-plugin");
    reg.enablePluginForWorkspace("ws-a", "billing-plugin");
    expect(reg.listWorkspaces()).not.toContain("ws-a");
  });

  it("overrideCount returns 0 for a workspace with no overrides", () => {
    const reg = new WorkspaceRegistry(new PluginHost(makeMcpRegistrar()));
    expect(reg.overrideCount("ws-unknown")).toBe(0);
  });
});

describe("WorkspaceRegistry — hooks", () => {
  it("disablePluginForWorkspace fires workspace.plugin.disabled with workspaceId and pluginId", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    const spy = vi.fn();
    host.hooks.addAction("workspace.plugin.disabled", spy);
    reg.disablePluginForWorkspace("ws-finance", "billing-plugin");
    expect(spy).toHaveBeenCalledWith({ workspaceId: "ws-finance", pluginId: "billing-plugin" });
  });

  it("enablePluginForWorkspace fires workspace.plugin.enabled with workspaceId and pluginId", () => {
    const host = makeHostWithPlugins();
    const reg = new WorkspaceRegistry(host);
    reg.disablePluginForWorkspace("ws-finance", "billing-plugin");
    const spy = vi.fn();
    host.hooks.addAction("workspace.plugin.enabled", spy);
    reg.enablePluginForWorkspace("ws-finance", "billing-plugin");
    expect(spy).toHaveBeenCalledWith({ workspaceId: "ws-finance", pluginId: "billing-plugin" });
  });
});
