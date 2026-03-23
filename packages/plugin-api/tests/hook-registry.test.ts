import { describe, it, expect, vi } from "vitest";
import {
  HookRegistry,
  PluginHost,
  PluginRegistrationError,
} from "../src/index.js";
import type {
  FicecalPlugin,
  BillingPeriodSummary,
  McpToolRegistrar,
  FilterCallback,
  ActionCallback,
} from "../src/index.js";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function makeMcpRegistrar(): McpToolRegistrar & { registered: unknown[] } {
  const registered: unknown[] = [];
  return { register: (tool) => { registered.push(tool); }, registered };
}

function makePlugin(overrides: Partial<FicecalPlugin> = {}): FicecalPlugin {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    contributions: {},
    ...overrides,
  };
}

const sampleSummary: BillingPeriodSummary = {
  provider: "aws",
  accountId: "123456789012",
  billingPeriodStart: "2026-01-01",
  billingPeriodEnd: "2026-02-01",
  totalCost: 1450.32,
  currency: "USD",
  lineItems: [
    { service: "AmazonBedrock", cost: 820.5, currency: "USD", startDate: "2026-01-01", endDate: "2026-02-01" },
  ],
};

// ─── HookRegistry — Filters ────────────────────────────────────────────────────

describe("HookRegistry — filters", () => {
  it("returns the original value when no listeners are registered", () => {
    const hooks = new HookRegistry();
    expect(hooks.applyFilter("my.filter", 42)).toBe(42);
  });

  it("passes the value through a single filter listener", () => {
    const hooks = new HookRegistry();
    hooks.addFilter<number>("double", (v) => v * 2);
    expect(hooks.applyFilter("double", 5)).toBe(10);
  });

  it("threads value through multiple listeners in priority order (lower first)", () => {
    const hooks = new HookRegistry();
    const log: string[] = [];
    hooks.addFilter<number>("chain", (v) => { log.push("p20"); return v + 20; }, 20);
    hooks.addFilter<number>("chain", (v) => { log.push("p5");  return v + 5;  }, 5);
    hooks.addFilter<number>("chain", (v) => { log.push("p10"); return v + 10; }, 10);
    // order: p5 → p10 → p20  →  0 + 5 + 10 + 20 = 35
    expect(hooks.applyFilter("chain", 0)).toBe(35);
    expect(log).toEqual(["p5", "p10", "p20"]);
  });

  it("listeners at the same priority run in insertion order (FIFO)", () => {
    const hooks = new HookRegistry();
    const log: string[] = [];
    hooks.addFilter<string>("fifo", (v) => { log.push("first"); return v + "1"; });
    hooks.addFilter<string>("fifo", (v) => { log.push("second"); return v + "2"; });
    hooks.addFilter<string>("fifo", (v) => { log.push("third"); return v + "3"; });
    hooks.applyFilter("fifo", "");
    expect(log).toEqual(["first", "second", "third"]);
  });

  it("passes extra args to each listener but does not thread them", () => {
    const hooks = new HookRegistry();
    const capturedArgs: unknown[][] = [];
    hooks.addFilter<number>("args-test", (v, ...args) => {
      capturedArgs.push(args);
      return v;
    });
    hooks.applyFilter("args-test", 1, "extra-a", "extra-b");
    expect(capturedArgs[0]).toEqual(["extra-a", "extra-b"]);
  });

  it("default priority is 10", () => {
    const hooks = new HookRegistry();
    const log: string[] = [];
    hooks.addFilter<string>("prio", (v) => { log.push("default"); return v; }); // priority 10
    hooks.addFilter<string>("prio", (v) => { log.push("p5");      return v; }, 5);
    hooks.applyFilter("prio", "");
    expect(log).toEqual(["p5", "default"]);
  });

  it("removeFilter removes the listener by callback reference", () => {
    const hooks = new HookRegistry();
    const cb: FilterCallback<number> = (v) => v * 100;
    hooks.addFilter("rm", cb);
    expect(hooks.filterCount("rm")).toBe(1);
    const removed = hooks.removeFilter("rm", cb);
    expect(removed).toBe(true);
    expect(hooks.filterCount("rm")).toBe(0);
    expect(hooks.applyFilter("rm", 7)).toBe(7); // pass-through after removal
  });

  it("removeFilter returns false when callback is not found", () => {
    const hooks = new HookRegistry();
    const cb: FilterCallback<number> = (v) => v;
    hooks.addFilter("exists", (v: number) => v);
    expect(hooks.removeFilter("exists", cb)).toBe(false);
  });

  it("removeFilter returns false for an unknown hook name", () => {
    const hooks = new HookRegistry();
    expect(hooks.removeFilter("no-such-hook", (v: number) => v)).toBe(false);
  });

  it("hasFilter returns true when listeners are registered, false otherwise", () => {
    const hooks = new HookRegistry();
    expect(hooks.hasFilter("h")).toBe(false);
    hooks.addFilter("h", (v: number) => v);
    expect(hooks.hasFilter("h")).toBe(true);
  });

  it("filterCount reflects the number of registered listeners", () => {
    const hooks = new HookRegistry();
    expect(hooks.filterCount("f")).toBe(0);
    hooks.addFilter("f", (v: number) => v);
    hooks.addFilter("f", (v: number) => v);
    expect(hooks.filterCount("f")).toBe(2);
  });

  it("registeredFilters lists hook names with active listeners", () => {
    const hooks = new HookRegistry();
    hooks.addFilter("filter-a", (v: number) => v);
    hooks.addFilter("filter-b", (v: number) => v);
    const names = hooks.registeredFilters;
    expect(names).toContain("filter-a");
    expect(names).toContain("filter-b");
  });

  it("registeredFilters excludes hooks after all listeners are removed", () => {
    const hooks = new HookRegistry();
    const cb: FilterCallback<number> = (v) => v;
    hooks.addFilter("removable", cb);
    hooks.removeFilter("removable", cb);
    expect(hooks.registeredFilters).not.toContain("removable");
  });
});

// ─── HookRegistry — Actions ────────────────────────────────────────────────────

describe("HookRegistry — actions", () => {
  it("doAction with no listeners is a no-op", () => {
    const hooks = new HookRegistry();
    expect(() => hooks.doAction("no-listeners", "arg")).not.toThrow();
  });

  it("doAction calls a single listener with supplied args", () => {
    const hooks = new HookRegistry();
    const spy = vi.fn();
    hooks.addAction("click", spy);
    hooks.doAction("click", "payload");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith("payload");
  });

  it("doAction calls multiple listeners in priority order", () => {
    const hooks = new HookRegistry();
    const log: string[] = [];
    hooks.addAction("ordered", () => { log.push("p30"); }, 30);
    hooks.addAction("ordered", () => { log.push("p1");  }, 1);
    hooks.addAction("ordered", () => { log.push("p10"); }, 10);
    hooks.doAction("ordered");
    expect(log).toEqual(["p1", "p10", "p30"]);
  });

  it("doAction: same priority runs in FIFO insertion order", () => {
    const hooks = new HookRegistry();
    const log: string[] = [];
    hooks.addAction("fifo-action", () => { log.push("A"); });
    hooks.addAction("fifo-action", () => { log.push("B"); });
    hooks.addAction("fifo-action", () => { log.push("C"); });
    hooks.doAction("fifo-action");
    expect(log).toEqual(["A", "B", "C"]);
  });

  it("doActionAsync awaits listeners sequentially", async () => {
    const hooks = new HookRegistry();
    const log: string[] = [];
    hooks.addAction("async-seq", async () => {
      await new Promise((r) => setTimeout(r, 5));
      log.push("slow");
    }, 5);
    hooks.addAction("async-seq", async () => {
      log.push("fast");
    }, 10);
    await hooks.doActionAsync("async-seq");
    expect(log).toEqual(["slow", "fast"]);
  });

  it("removeAction removes by callback reference", () => {
    const hooks = new HookRegistry();
    const cb: ActionCallback = vi.fn();
    hooks.addAction("rm-action", cb);
    expect(hooks.actionCount("rm-action")).toBe(1);
    const removed = hooks.removeAction("rm-action", cb);
    expect(removed).toBe(true);
    hooks.doAction("rm-action");
    expect(cb).not.toHaveBeenCalled();
  });

  it("removeAction returns false when callback is not registered", () => {
    const hooks = new HookRegistry();
    hooks.addAction("exists-action", () => {});
    expect(hooks.removeAction("exists-action", () => {})).toBe(false);
  });

  it("hasAction returns correct state", () => {
    const hooks = new HookRegistry();
    expect(hooks.hasAction("a")).toBe(false);
    hooks.addAction("a", () => {});
    expect(hooks.hasAction("a")).toBe(true);
  });

  it("actionCount reflects the number of registered listeners", () => {
    const hooks = new HookRegistry();
    hooks.addAction("cnt", () => {});
    hooks.addAction("cnt", () => {});
    expect(hooks.actionCount("cnt")).toBe(2);
  });

  it("registeredActions lists hook names with active listeners", () => {
    const hooks = new HookRegistry();
    hooks.addAction("action-x", () => {});
    expect(hooks.registeredActions).toContain("action-x");
  });
});

// ─── HookRegistry — isolation ──────────────────────────────────────────────────

describe("HookRegistry — isolation", () => {
  it("filters and actions for different hook names do not interfere", () => {
    const hooks = new HookRegistry();
    hooks.addFilter<number>("filter-one", (v) => v + 1);
    hooks.addFilter<number>("filter-two", (v) => v * 10);
    expect(hooks.applyFilter("filter-one", 5)).toBe(6);
    expect(hooks.applyFilter("filter-two", 5)).toBe(50);
  });

  it("registeredFilters and registeredActions are separate namespaces", () => {
    const hooks = new HookRegistry();
    hooks.addFilter("same-name", (v: number) => v);
    hooks.addAction("same-name", () => {});
    expect(hooks.hasFilter("same-name")).toBe(true);
    expect(hooks.hasAction("same-name")).toBe(true);
    expect(hooks.filterCount("same-name")).toBe(1);
    expect(hooks.actionCount("same-name")).toBe(1);
  });
});

// ─── Production hook: billing.estimate.actual.result ──────────────────────────

describe("billing.estimate.actual.result integration (Phase 7 production hook)", () => {
  it("transforms a BillingPeriodSummary through the filter chain", () => {
    const hooks = new HookRegistry();

    // Plugin 1: mark all line items with a tag
    hooks.addFilter<BillingPeriodSummary>(
      "billing.estimate.actual.result",
      (summary) => ({
        ...summary,
        lineItems: summary.lineItems.map((li) => ({
          ...li,
          tags: { ...li.tags, processed: "true" },
        })),
      }),
      10,
    );

    // Plugin 2: cap total cost at 1000 (runs after plugin 1)
    hooks.addFilter<BillingPeriodSummary>(
      "billing.estimate.actual.result",
      (summary) => ({
        ...summary,
        totalCost: Math.min(summary.totalCost, 1000),
      }),
      20,
    );

    const result = hooks.applyFilter(
      "billing.estimate.actual.result",
      sampleSummary,
      { provider: "aws", period: "2026-01" },
    );

    expect(result.totalCost).toBe(1000);
    expect(result.lineItems[0]?.tags?.processed).toBe("true");
    // original is unchanged (filters receive a new object each time in this example)
    expect(sampleSummary.totalCost).toBe(1450.32);
  });
});

// ─── PluginHost — admin panel: plugin enable / disable ────────────────────────

describe("PluginHost — plugin enable/disable (admin panel)", () => {
  it("all plugins start enabled in listPluginEntries", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.register(makePlugin({ id: "plugin-a" }));
    host.register(makePlugin({ id: "plugin-b" }));
    const entries = host.listPluginEntries();
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.enabled)).toBe(true);
  });

  it("disablePlugin marks a plugin as disabled in listPluginEntries", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.register(makePlugin({ id: "my-plugin" }));
    host.disablePlugin("my-plugin");
    const entry = host.listPluginEntries().find((e) => e.plugin.id === "my-plugin");
    expect(entry?.enabled).toBe(false);
  });

  it("enablePlugin re-enables a disabled plugin", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.register(makePlugin({ id: "my-plugin" }));
    host.disablePlugin("my-plugin");
    host.enablePlugin("my-plugin");
    expect(host.isPluginEnabled("my-plugin")).toBe(true);
  });

  it("isPluginEnabled returns false for unknown plugin id", () => {
    const host = new PluginHost(makeMcpRegistrar());
    expect(host.isPluginEnabled("no-such-plugin")).toBe(false);
  });

  it("disablePlugin throws for an unregistered plugin id", () => {
    const host = new PluginHost(makeMcpRegistrar());
    expect(() => host.disablePlugin("ghost")).toThrow("ghost");
  });

  it("enablePlugin throws for an unregistered plugin id", () => {
    const host = new PluginHost(makeMcpRegistrar());
    expect(() => host.enablePlugin("ghost")).toThrow("ghost");
  });

  it("disablePlugin fires plugin.disabled action via hooks", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.register(makePlugin({ id: "hookable" }));
    const spy = vi.fn();
    host.hooks.addAction("plugin.disabled", spy);
    host.disablePlugin("hookable");
    expect(spy).toHaveBeenCalledWith("hookable");
  });

  it("enablePlugin fires plugin.enabled action via hooks", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.register(makePlugin({ id: "hookable" }));
    host.disablePlugin("hookable");
    const spy = vi.fn();
    host.hooks.addAction("plugin.enabled", spy);
    host.enablePlugin("hookable");
    expect(spy).toHaveBeenCalledWith("hookable");
  });

  it("register fires plugin.registered action via hooks", () => {
    const host = new PluginHost(makeMcpRegistrar());
    const spy = vi.fn();
    host.hooks.addAction("plugin.registered", spy);
    const plugin = makePlugin();
    host.register(plugin);
    expect(spy).toHaveBeenCalledWith(plugin);
  });
});

// ─── PluginHost — admin panel: feature flag management ────────────────────────

describe("PluginHost — feature flag management (admin panel)", () => {
  it("declareFeatureFlag registers a flag for listing", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.declareFeatureFlag({
      key: "commitment-management",
      displayName: "Commitment Management",
      phase: "Phase 1",
    });
    const flags = host.listFeatureFlags();
    expect(flags).toHaveLength(1);
    expect(flags[0]?.key).toBe("commitment-management");
    expect(flags[0]?.displayName).toBe("Commitment Management");
    expect(flags[0]?.phase).toBe("Phase 1");
  });

  it("listFeatureFlags reflects active state from constructor", () => {
    const host = new PluginHost(makeMcpRegistrar(), ["commitment-management"]);
    host.declareFeatureFlag({ key: "commitment-management", displayName: "CM" });
    host.declareFeatureFlag({ key: "shared-cost-allocation", displayName: "SCA" });
    const flags = host.listFeatureFlags();
    expect(flags.find((f) => f.key === "commitment-management")?.active).toBe(true);
    expect(flags.find((f) => f.key === "shared-cost-allocation")?.active).toBe(false);
  });

  it("enableFeatureFlag activates an inactive flag", () => {
    const host = new PluginHost(makeMcpRegistrar());
    host.declareFeatureFlag({ key: "my-flag", displayName: "My Flag" });
    expect(host.isFeatureFlagActive("my-flag")).toBe(false);
    host.enableFeatureFlag("my-flag");
    expect(host.isFeatureFlagActive("my-flag")).toBe(true);
  });

  it("disableFeatureFlag deactivates an active flag", () => {
    const host = new PluginHost(makeMcpRegistrar(), ["my-flag"]);
    host.declareFeatureFlag({ key: "my-flag", displayName: "My Flag" });
    expect(host.isFeatureFlagActive("my-flag")).toBe(true);
    host.disableFeatureFlag("my-flag");
    expect(host.isFeatureFlagActive("my-flag")).toBe(false);
    expect(host.listFeatureFlags()[0]?.active).toBe(false);
  });

  it("enableFeatureFlag fires featureflag.changed action via hooks", () => {
    const host = new PluginHost(makeMcpRegistrar());
    const spy = vi.fn();
    host.hooks.addAction("featureflag.changed", spy);
    host.enableFeatureFlag("some-flag");
    expect(spy).toHaveBeenCalledWith({ key: "some-flag", active: true });
  });

  it("disableFeatureFlag fires featureflag.changed action via hooks", () => {
    const host = new PluginHost(makeMcpRegistrar(), ["some-flag"]);
    const spy = vi.fn();
    host.hooks.addAction("featureflag.changed", spy);
    host.disableFeatureFlag("some-flag");
    expect(spy).toHaveBeenCalledWith({ key: "some-flag", active: false });
  });

  it("enableFeatureFlag is idempotent — fires hook only once per change", () => {
    const host = new PluginHost(makeMcpRegistrar(), ["already-on"]);
    const spy = vi.fn();
    host.hooks.addAction("featureflag.changed", spy);
    host.enableFeatureFlag("already-on"); // already active — no-op
    expect(spy).not.toHaveBeenCalled();
  });

  it("disableFeatureFlag is idempotent — fires hook only once per change", () => {
    const host = new PluginHost(makeMcpRegistrar());
    const spy = vi.fn();
    host.hooks.addAction("featureflag.changed", spy);
    host.disableFeatureFlag("already-off"); // already inactive — no-op
    expect(spy).not.toHaveBeenCalled();
  });

  it("host.hooks exposes the full HookRegistry API", () => {
    const host = new PluginHost(makeMcpRegistrar());
    // Structural check: verify all four core methods are present
    expect(typeof host.hooks.addFilter).toBe("function");
    expect(typeof host.hooks.addAction).toBe("function");
    expect(typeof host.hooks.applyFilter).toBe("function");
    expect(typeof host.hooks.doAction).toBe("function");
    expect(typeof host.hooks.doActionAsync).toBe("function");
    expect(typeof host.hooks.removeFilter).toBe("function");
    expect(typeof host.hooks.removeAction).toBe("function");
  });
});
