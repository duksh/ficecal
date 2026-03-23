// ─── PluginSandbox ─────────────────────────────────────────────────────────────
//
// Phase 10B P5: wraps plugin execution with:
//   - Per-call timeout (configurable, default 5000ms)
//   - SandboxViolationError on timeout or forbidden access
//   - Call count tracking per plugin ID
//   - Error isolation: plugin errors are caught and re-thrown as SandboxViolationError

export class SandboxViolationError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly reason: string,
  ) {
    super(`Plugin [${pluginId}] sandbox violation: ${reason}`);
    this.name = "SandboxViolationError";
  }
}

export interface SandboxOptions {
  /** Execution timeout in ms. Default: 5000 */
  timeoutMs?: number;
  /** Max allowed calls per plugin before rate-limit kicks in. Default: unlimited (0) */
  maxCallsPerPlugin?: number;
}

export interface SandboxCallContext {
  pluginId: string;
  operationName?: string;
}

export class PluginSandbox {
  private readonly timeoutMs: number;
  private readonly maxCallsPerPlugin: number;
  private readonly callCounts = new Map<string, number>();

  constructor(options: SandboxOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.maxCallsPerPlugin = options.maxCallsPerPlugin ?? 0;
  }

  /** Execute fn inside the sandbox. Throws SandboxViolationError on timeout or rate-limit. */
  async execute<T>(fn: () => Promise<T>, ctx: SandboxCallContext): Promise<T> {
    const { pluginId } = ctx;

    const currentCount = this.callCounts.get(pluginId) ?? 0;

    if (this.maxCallsPerPlugin > 0 && currentCount >= this.maxCallsPerPlugin) {
      throw new SandboxViolationError(
        pluginId,
        `call limit exceeded (${currentCount}/${this.maxCallsPerPlugin})`,
      );
    }

    // Increment BEFORE running fn
    this.callCounts.set(pluginId, currentCount + 1);

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(
          new SandboxViolationError(
            pluginId,
            `execution timed out after ${this.timeoutMs}ms`,
          ),
        );
      }, this.timeoutMs);
      // Allow Node process to exit if only this timer is pending
      if (typeof timer === "object" && "unref" in timer) {
        (timer as { unref(): void }).unref();
      }
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } catch (err) {
      if (err instanceof SandboxViolationError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new SandboxViolationError(pluginId, `unhandled error: ${message}`);
    }
  }

  /** Returns the call count for the given plugin ID. */
  getCallCount(pluginId: string): number {
    return this.callCounts.get(pluginId) ?? 0;
  }

  /** Reset call counter for a plugin (e.g. after re-enable). */
  resetCallCount(pluginId: string): void {
    this.callCounts.delete(pluginId);
  }

  /** Reset all call counters. */
  resetAllCallCounts(): void {
    this.callCounts.clear();
  }
}
