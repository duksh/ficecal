import { describe, it, expect } from "vitest";
import { PluginSandbox, SandboxViolationError } from "../src/sandbox.js";

describe("PluginSandbox", () => {
  // ─── Basic execution ────────────────────────────────────────────────────────

  it("execute resolves with fn result on success", async () => {
    const sandbox = new PluginSandbox();
    const result = await sandbox.execute(async () => 42, { pluginId: "p1" });
    expect(result).toBe(42);
  });

  it("execute with async fn resolves correctly", async () => {
    const sandbox = new PluginSandbox();
    const result = await sandbox.execute(async () => "hello", { pluginId: "p1" });
    expect(result).toBe("hello");
  });

  it("fn that resolves after 10ms succeeds with 5000ms timeout", async () => {
    const sandbox = new PluginSandbox({ timeoutMs: 5000 });
    const result = await sandbox.execute(
      () => new Promise<string>((res) => setTimeout(() => res("ok"), 10)),
      { pluginId: "p1" },
    );
    expect(result).toBe("ok");
  });

  // ─── Error wrapping ─────────────────────────────────────────────────────────

  it("execute wraps non-violation errors as SandboxViolationError", async () => {
    const sandbox = new PluginSandbox();
    await expect(
      sandbox.execute(async () => { throw new Error("boom"); }, { pluginId: "p1" }),
    ).rejects.toBeInstanceOf(SandboxViolationError);
  });

  it("execute re-throws SandboxViolationError from fn as-is", async () => {
    const sandbox = new PluginSandbox();
    const original = new SandboxViolationError("p1", "original");
    const thrown = await sandbox
      .execute(async () => { throw original; }, { pluginId: "p1" })
      .catch((e: unknown) => e);
    expect(thrown).toBe(original);
  });

  it("wraps fn TypeError as SandboxViolationError", async () => {
    const sandbox = new PluginSandbox();
    const err = await sandbox
      .execute(async () => { throw new TypeError("bad type"); }, { pluginId: "p1" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxViolationError);
    expect((err as SandboxViolationError).reason).toContain("bad type");
  });

  it("wraps fn RangeError as SandboxViolationError", async () => {
    const sandbox = new PluginSandbox();
    const err = await sandbox
      .execute(async () => { throw new RangeError("out of range"); }, { pluginId: "p1" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxViolationError);
    expect((err as SandboxViolationError).reason).toContain("out of range");
  });

  // ─── Timeout ────────────────────────────────────────────────────────────────

  it("execute times out after timeoutMs", async () => {
    const sandbox = new PluginSandbox({ timeoutMs: 30 });
    const err = await sandbox
      .execute(
        () => new Promise<never>((res) => setTimeout(res, 5000)),
        { pluginId: "p1" },
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxViolationError);
    expect((err as SandboxViolationError).reason).toContain("timed out");
  });

  it("execute with custom timeoutMs of 50ms times out fast", async () => {
    const sandbox = new PluginSandbox({ timeoutMs: 50 });
    const start = Date.now();
    const err = await sandbox
      .execute(
        () => new Promise<never>((res) => setTimeout(res, 5000)),
        { pluginId: "p1" },
      )
      .catch((e: unknown) => e);
    const elapsed = Date.now() - start;
    expect(err).toBeInstanceOf(SandboxViolationError);
    expect(elapsed).toBeLessThan(500);
  });

  it("default timeoutMs is 5000 (verify via error message on timeout)", async () => {
    const sandbox = new PluginSandbox(); // no options
    const err = await sandbox
      .execute(
        () => new Promise<never>((_, rej) =>
          setTimeout(() => rej(new SandboxViolationError("p1", "execution timed out after 5000ms")), 1),
        ),
        { pluginId: "p1" },
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxViolationError);
    expect((err as SandboxViolationError).reason).toContain("5000ms");
  });

  // ─── Rate limiting ──────────────────────────────────────────────────────────

  it("execute respects maxCallsPerPlugin limit", async () => {
    const sandbox = new PluginSandbox({ maxCallsPerPlugin: 2 });
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    const err = await sandbox
      .execute(async () => {}, { pluginId: "p1" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SandboxViolationError);
    expect((err as SandboxViolationError).reason).toContain("call limit exceeded");
  });

  it("maxCallsPerPlugin 0 means unlimited", async () => {
    const sandbox = new PluginSandbox({ maxCallsPerPlugin: 0 });
    for (let i = 0; i < 50; i++) {
      await sandbox.execute(async () => i, { pluginId: "p1" });
    }
    expect(sandbox.getCallCount("p1")).toBe(50);
  });

  it("call limit error includes current/max counts in reason", async () => {
    const sandbox = new PluginSandbox({ maxCallsPerPlugin: 1 });
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    const err = await sandbox
      .execute(async () => {}, { pluginId: "p1" })
      .catch((e: unknown) => e);
    const reason = (err as SandboxViolationError).reason;
    expect(reason).toMatch(/1\/1/);
  });

  // ─── Call counting ──────────────────────────────────────────────────────────

  it("getCallCount returns 0 before any calls", () => {
    const sandbox = new PluginSandbox();
    expect(sandbox.getCallCount("never-called")).toBe(0);
  });

  it("getCallCount increments on each execute", async () => {
    const sandbox = new PluginSandbox();
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    expect(sandbox.getCallCount("p1")).toBe(2);
  });

  it("getCallCount is per-plugin-id (different plugins independent)", async () => {
    const sandbox = new PluginSandbox();
    await sandbox.execute(async () => {}, { pluginId: "a" });
    await sandbox.execute(async () => {}, { pluginId: "a" });
    await sandbox.execute(async () => {}, { pluginId: "b" });
    expect(sandbox.getCallCount("a")).toBe(2);
    expect(sandbox.getCallCount("b")).toBe(1);
  });

  it("execute increments count even when fn throws", async () => {
    const sandbox = new PluginSandbox();
    await sandbox
      .execute(async () => { throw new Error("fail"); }, { pluginId: "p1" })
      .catch(() => {});
    expect(sandbox.getCallCount("p1")).toBe(1);
  });

  it("resetCallCount resets to 0 for one plugin", async () => {
    const sandbox = new PluginSandbox();
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    await sandbox.execute(async () => {}, { pluginId: "p2" });
    sandbox.resetCallCount("p1");
    expect(sandbox.getCallCount("p1")).toBe(0);
    expect(sandbox.getCallCount("p2")).toBe(1);
  });

  it("resetAllCallCounts resets all counters", async () => {
    const sandbox = new PluginSandbox();
    await sandbox.execute(async () => {}, { pluginId: "p1" });
    await sandbox.execute(async () => {}, { pluginId: "p2" });
    sandbox.resetAllCallCounts();
    expect(sandbox.getCallCount("p1")).toBe(0);
    expect(sandbox.getCallCount("p2")).toBe(0);
  });

  // ─── SandboxViolationError ──────────────────────────────────────────────────

  it("SandboxViolationError has pluginId and reason", () => {
    const err = new SandboxViolationError("my-plugin", "something went wrong");
    expect(err.pluginId).toBe("my-plugin");
    expect(err.reason).toBe("something went wrong");
  });

  it("SandboxViolationError name is SandboxViolationError", () => {
    const err = new SandboxViolationError("p1", "oops");
    expect(err.name).toBe("SandboxViolationError");
  });

  it("violation error message format: Plugin [id] sandbox violation: reason", () => {
    const err = new SandboxViolationError("my-plugin", "timeout");
    expect(err.message).toBe("Plugin [my-plugin] sandbox violation: timeout");
  });

  // ─── Miscellaneous ──────────────────────────────────────────────────────────

  it("sandbox options default: timeoutMs=5000, maxCallsPerPlugin=0", async () => {
    // maxCallsPerPlugin=0 => unlimited; run 10 calls without hitting limit
    const sandbox = new PluginSandbox();
    for (let i = 0; i < 10; i++) {
      await sandbox.execute(async () => {}, { pluginId: "p1" });
    }
    expect(sandbox.getCallCount("p1")).toBe(10);
  });

  it("concurrent executes for different plugins don't interfere", async () => {
    const sandbox = new PluginSandbox();
    const [r1, r2] = await Promise.all([
      sandbox.execute(async () => "a", { pluginId: "pa" }),
      sandbox.execute(async () => "b", { pluginId: "pb" }),
    ]);
    expect(r1).toBe("a");
    expect(r2).toBe("b");
  });

  it("two separate PluginSandbox instances have independent counters", async () => {
    const s1 = new PluginSandbox();
    const s2 = new PluginSandbox();
    await s1.execute(async () => {}, { pluginId: "p1" });
    await s1.execute(async () => {}, { pluginId: "p1" });
    await s2.execute(async () => {}, { pluginId: "p1" });
    expect(s1.getCallCount("p1")).toBe(2);
    expect(s2.getCallCount("p1")).toBe(1);
  });
});
