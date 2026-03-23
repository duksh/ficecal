// ─── HookRegistry ──────────────────────────────────────────────────────────────
//
// WordPress-style priority-ordered hook system for FiceCal plugins.
//
// Two hook flavors:
//   Filters  — transform a value through a listener chain; final value returned.
//              Use addFilter / applyFilter.
//   Actions  — fire side-effect listeners in priority order; no return piping.
//              Use addAction / doAction (sync) / doActionAsync (sequential async).
//
// Priority ordering: lower number = runs first (default: 10).
// Within the same priority, listeners run in insertion order (FIFO).
//
// Zero-dependency: no imports.
//
// ─── Production hook points (Phase 7) ─────────────────────────────────────────
//
//   billing.estimate.actual.result   (filter)
//     Transform a BillingPeriodSummary returned by a billing adapter.
//     Signature: applyFilter("billing.estimate.actual.result", summary, { provider, period })
//     Plugins use this to normalise, enrich, or redact billing data before it
//     reaches the economics engine.
//
//   plugin.registered                (action)
//     Fired after a plugin is successfully registered in PluginHost.
//     Signature: doAction("plugin.registered", plugin)
//
//   plugin.enabled                   (action)
//     Fired after enablePlugin() is called on a disabled plugin.
//     Signature: doAction("plugin.enabled", pluginId)
//
//   plugin.disabled                  (action)
//     Fired after disablePlugin() is called on an enabled plugin.
//     Signature: doAction("plugin.disabled", pluginId)
//
//   featureflag.changed              (action)
//     Fired after enableFeatureFlag() or disableFeatureFlag().
//     Signature: doAction("featureflag.changed", { key, active })
//
// ──────────────────────────────────────────────────────────────────────────────

/** A filter callback transforms a value and returns the modified value. */
export type FilterCallback<T = unknown> = (value: T, ...args: unknown[]) => T;

/** An action callback produces side effects; may be sync or async. */
export type ActionCallback = (...args: unknown[]) => void | Promise<void>;

// ─── Internal slot shapes ──────────────────────────────────────────────────────

interface FilterSlot {
  callback: FilterCallback;
  priority: number;
  uid: number;
}

interface ActionSlot {
  callback: ActionCallback;
  priority: number;
  uid: number;
}

// ─── Stable sort insertion helper ──────────────────────────────────────────────
// Inserts `slot` into `slots` maintaining ascending priority order.
// Within the same priority, earlier uid (insertion order) comes first → FIFO.

function insertSortedFilter(slots: FilterSlot[], slot: FilterSlot): void {
  let lo = 0;
  let hi = slots.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const s = slots[mid]!;
    if (s.priority < slot.priority || (s.priority === slot.priority && s.uid < slot.uid)) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  slots.splice(lo, 0, slot);
}

function insertSortedAction(slots: ActionSlot[], slot: ActionSlot): void {
  let lo = 0;
  let hi = slots.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const s = slots[mid]!;
    if (s.priority < slot.priority || (s.priority === slot.priority && s.uid < slot.uid)) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  slots.splice(lo, 0, slot);
}

// ─── HookRegistry ─────────────────────────────────────────────────────────────

export class HookRegistry {
  private readonly _filters = new Map<string, FilterSlot[]>();
  private readonly _actions = new Map<string, ActionSlot[]>();
  private _uid = 0;

  // ─── Filters ───────────────────────────────────────────────────────────────

  /**
   * Register a filter listener.
   *
   * Listeners run in ascending priority order (lower = earlier).
   * Default priority is 10 (matches WordPress convention).
   *
   * @param hookName  Hook identifier, e.g. "billing.estimate.actual.result"
   * @param callback  Receives the current value (plus any extra args) and must
   *                  return the (possibly modified) value.
   * @param priority  Execution order. Default: 10.
   */
  addFilter<T>(hookName: string, callback: FilterCallback<T>, priority = 10): void {
    if (!this._filters.has(hookName)) this._filters.set(hookName, []);
    const slot: FilterSlot = { callback: callback as FilterCallback, priority, uid: this._uid++ };
    insertSortedFilter(this._filters.get(hookName)!, slot);
  }

  /**
   * Run all filter listeners for `hookName`, threading `value` through each.
   *
   * If no listeners are registered the original value is returned unchanged.
   * Extra `args` are passed to each listener after `value` but are NOT threaded
   * (each listener receives the same original args, only value threads).
   */
  applyFilter<T>(hookName: string, value: T, ...args: unknown[]): T {
    const slots = this._filters.get(hookName);
    if (!slots || slots.length === 0) return value;
    let current: unknown = value;
    for (const slot of slots) {
      current = slot.callback(current, ...args);
    }
    return current as T;
  }

  /**
   * Remove a specific filter listener identified by callback reference.
   * Returns true if the listener was found and removed, false otherwise.
   *
   * Accepts `FilterCallback<any>` so callers with a typed callback (e.g.
   * `FilterCallback<number>`) can pass it directly without a cast — the
   * reference comparison doesn't depend on the generic type.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeFilter(hookName: string, callback: FilterCallback<any>): boolean {
    const slots = this._filters.get(hookName);
    if (!slots) return false;
    const idx = slots.findIndex((s) => s.callback === callback);
    if (idx === -1) return false;
    slots.splice(idx, 1);
    return true;
  }

  /** True if at least one filter listener is registered for `hookName`. */
  hasFilter(hookName: string): boolean {
    const slots = this._filters.get(hookName);
    return slots !== undefined && slots.length > 0;
  }

  /** Number of filter listeners registered for `hookName`. */
  filterCount(hookName: string): number {
    return this._filters.get(hookName)?.length ?? 0;
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /**
   * Register an action listener.
   *
   * Action listeners produce side effects; their return values are ignored.
   * Use `doAction` for synchronous listeners, `doActionAsync` when any listener
   * is async and ordering/completion matters.
   *
   * @param hookName  Hook identifier, e.g. "plugin.registered"
   * @param callback  Side-effect function (sync or async).
   * @param priority  Execution order. Default: 10.
   */
  addAction(hookName: string, callback: ActionCallback, priority = 10): void {
    if (!this._actions.has(hookName)) this._actions.set(hookName, []);
    const slot: ActionSlot = { callback, priority, uid: this._uid++ };
    insertSortedAction(this._actions.get(hookName)!, slot);
  }

  /**
   * Fire all action listeners for `hookName` synchronously.
   *
   * Async callbacks are called but their promises are NOT awaited —
   * use `doActionAsync` when you need guaranteed completion ordering.
   * Any synchronous throw propagates immediately.
   */
  doAction(hookName: string, ...args: unknown[]): void {
    const slots = this._actions.get(hookName);
    if (!slots) return;
    for (const slot of slots) {
      slot.callback(...args);
    }
  }

  /**
   * Fire all action listeners for `hookName` sequentially, awaiting each.
   *
   * Guarantees that listener[N+1] does not start until listener[N] resolves.
   * Any rejected promise propagates and stops the chain.
   */
  async doActionAsync(hookName: string, ...args: unknown[]): Promise<void> {
    const slots = this._actions.get(hookName);
    if (!slots) return;
    for (const slot of slots) {
      await slot.callback(...args);
    }
  }

  /**
   * Remove a specific action listener identified by callback reference.
   * Returns true if found and removed, false otherwise.
   */
  removeAction(hookName: string, callback: ActionCallback): boolean {
    const slots = this._actions.get(hookName);
    if (!slots) return false;
    const idx = slots.findIndex((s) => s.callback === callback);
    if (idx === -1) return false;
    slots.splice(idx, 1);
    return true;
  }

  /** True if at least one action listener is registered for `hookName`. */
  hasAction(hookName: string): boolean {
    const slots = this._actions.get(hookName);
    return slots !== undefined && slots.length > 0;
  }

  /** Number of action listeners registered for `hookName`. */
  actionCount(hookName: string): number {
    return this._actions.get(hookName)?.length ?? 0;
  }

  // ─── Introspection ─────────────────────────────────────────────────────────

  /** Names of all filter hooks that have at least one listener registered. */
  get registeredFilters(): string[] {
    return [...this._filters.keys()].filter(
      (k) => (this._filters.get(k)?.length ?? 0) > 0,
    );
  }

  /** Names of all action hooks that have at least one listener registered. */
  get registeredActions(): string[] {
    return [...this._actions.keys()].filter(
      (k) => (this._actions.get(k)?.length ?? 0) > 0,
    );
  }
}
