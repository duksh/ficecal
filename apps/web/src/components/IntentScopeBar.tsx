// ─── IntentScopeBar ───────────────────────────────────────────────────────────
//
// Displays and controls the active Intent + Scope + Mode triple.
// Uses IntentScopeState from ui-foundation as the single source of truth.
//
// U3: Scope degradation guards — tracks canonical (widest) user-set scope and
// warns with an amber banner when an auto-computed scope change narrows it.

import { useState, useEffect, useRef } from "react";
import {
  ALL_INTENTS,
  ALL_SCOPES,
  ALL_MODES,
  INTENT_LABELS,
  SCOPE_LABELS,
  MODE_LABELS,
} from "@ficecal/ui-foundation";
import type {
  IntentScopeState,
  LocalizationShell,
  Intent,
  Scope,
  Mode,
} from "@ficecal/ui-foundation";

// ─── Scope rank (wider → higher rank) ────────────────────────────────────────
//
// "executive-strategy" covers the broadest FinOps lens.
// "baseline-unit-economics" is the narrowest (single service/unit focus).
// Narrowing = moving from higher rank to lower rank.

const SCOPE_RANK: Record<Scope, number> = {
  "executive-strategy":         3,
  "architecture-tradeoffs":     2,
  "optimization-opportunities": 1,
  "baseline-unit-economics":    0,
};

function scopeRank(scope: Scope): number {
  return SCOPE_RANK[scope] ?? 0;
}

interface Props {
  intentScope: IntentScopeState;
  i18n: LocalizationShell;
  /** Notify parent that mode changed (so existing panel routing still works). */
  onModeChange?: (mode: Mode) => void;
  /** Called when an auto-computed scope change degrades from `from` to `to`. */
  onScopeDegrade?: (from: string, to: string) => void;
  /**
   * U3: Scope degradation guards — external scopes that are partially unavailable.
   * A ⚠ warning icon is shown next to them; selection is still allowed.
   */
  degradedScopes?: string[];
  /**
   * U3: Scope degradation guards — external scopes that are fully blocked/unavailable.
   * A 🔒 icon is shown; the option is disabled.
   */
  blockedScopes?: string[];
}

export function IntentScopeBar({ intentScope, i18n, onModeChange, onScopeDegrade, degradedScopes = [], blockedScopes = [] }: Props) {
  const [snapshot, setSnapshot] = useState(intentScope.get());

  // ── U3: Canonical scope tracking ──────────────────────────────────────────
  // The "canonical" scope is the widest scope that was set intentionally by the
  // user. User-initiated changes always update canonical scope (no warning).
  // Auto-computed changes (e.g. intent auto-scope) that narrow the scope trigger
  // the degradation banner.

  const canonicalScopeRef = useRef<Scope>(intentScope.get().scope);
  const [degradedFrom, setDegradedFrom]   = useState<Scope | null>(null);
  const [degradedTo,   setDegradedTo]     = useState<Scope | null>(null);
  const [showDegradation, setShowDegradation] = useState(false);

  // Whether the next subscription update is coming from a user-initiated action.
  // We set this flag BEFORE calling intentScope methods in the handlers below.
  const userInitiatedRef = useRef(false);

  useEffect(() => {
    return intentScope.subscribe((next) => {
      setSnapshot(next);
      onModeChange?.(next.mode);

      // ── Degradation detection ─────────────────────────────────────────────
      const prevScope = canonicalScopeRef.current;
      const nextScope = next.scope;

      if (userInitiatedRef.current) {
        // User explicitly changed scope (or intent+scope) — update canonical,
        // clear any existing warning.
        if (scopeRank(nextScope) >= scopeRank(prevScope)) {
          canonicalScopeRef.current = nextScope;
        } else {
          // User voluntarily narrowed — still update canonical (their intent)
          canonicalScopeRef.current = nextScope;
        }
        setShowDegradation(false);
        setDegradedFrom(null);
        setDegradedTo(null);
        userInitiatedRef.current = false;
      } else if (
        nextScope !== prevScope &&
        scopeRank(nextScope) < scopeRank(prevScope)
      ) {
        // Auto-computed scope change narrowed the scope — show warning
        setDegradedFrom(prevScope);
        setDegradedTo(nextScope);
        setShowDegradation(true);
        onScopeDegrade?.(prevScope, nextScope);
      } else {
        // Auto-computed but not a demotion (same scope or widening) — no warning
        if (nextScope !== prevScope) {
          canonicalScopeRef.current = nextScope;
        }
      }
    });
  }, [intentScope, onModeChange, onScopeDegrade]);

  function handleIntent(e: React.ChangeEvent<HTMLSelectElement>) {
    // setIntent with autoScope=true may auto-narrow scope; mark as user-initiated
    // so canonical updates to user's chosen intent affinity (no degradation warning).
    userInitiatedRef.current = true;
    intentScope.setIntent(e.target.value as Intent, /* autoScope */ true);
  }

  function handleScope(e: React.ChangeEvent<HTMLSelectElement>) {
    // Direct user scope selection — always update canonical, never warn.
    userInitiatedRef.current = true;
    const newScope = e.target.value as Scope;
    canonicalScopeRef.current = newScope;
    intentScope.setScope(newScope);
  }

  function handleMode(e: React.ChangeEvent<HTMLSelectElement>) {
    userInitiatedRef.current = true;
    intentScope.setMode(e.target.value as Mode);
  }

  function handleBack() {
    userInitiatedRef.current = true;
    intentScope.back();
  }

  function handleRestoreScope() {
    if (!degradedFrom) return;
    userInitiatedRef.current = true;
    canonicalScopeRef.current = degradedFrom;
    intentScope.setScope(degradedFrom);
    setShowDegradation(false);
    setDegradedFrom(null);
    setDegradedTo(null);
  }

  function dismissDegradation() {
    setShowDegradation(false);
  }

  const hasScopeAvailabilityIssues = degradedScopes.length > 0 || blockedScopes.length > 0;

  return (
    <nav className="intent-scope-bar" aria-label="Intent and scope controls">

      {/* ── U3: Scope availability banner ─────────────────────────────────── */}
      {hasScopeAvailabilityIssues && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            width: "100%",
            marginBottom: "0.5rem",
            padding: "0.4rem 0.75rem",
            background: "var(--fc-warn-bg, #fefce8)",
            border: "1px solid var(--fc-warn, #f59e0b)",
            borderRadius: "0.375rem",
            fontSize: "0.81rem",
            color: "var(--fc-text, #111)",
          }}
        >
          ⚠ Some scopes have limited data availability. Results may be incomplete.
          {blockedScopes.length > 0 && (
            <span style={{ marginLeft: "0.4rem" }}>
              Blocked: <strong>{blockedScopes.join(", ")}</strong>
            </span>
          )}
        </div>
      )}

      <div className="intent-scope-bar__group">
        <label htmlFor="fc-intent">{i18n.t("ui.title")} Intent</label>
        <select id="fc-intent" value={snapshot.intent} onChange={handleIntent}>
          {ALL_INTENTS.map((intent) => (
            <option key={intent} value={intent}>
              {INTENT_LABELS[intent]}
            </option>
          ))}
        </select>
      </div>

      <div className="intent-scope-bar__group">
        <label htmlFor="fc-scope">Scope</label>
        <select id="fc-scope" value={snapshot.scope} onChange={handleScope}>
          {ALL_SCOPES.map((scope) => {
            const isBlocked  = blockedScopes.includes(scope);
            const isDegraded = degradedScopes.includes(scope);
            return (
              <option key={scope} value={scope} disabled={isBlocked}>
                {isBlocked ? "🔒 " : isDegraded ? "⚠ " : ""}
                {SCOPE_LABELS[scope]}
                {isBlocked ? " (unavailable)" : isDegraded ? " (partial)" : ""}
              </option>
            );
          })}
        </select>
        {/* Per-scope tooltip for currently selected degraded scope */}
        {degradedScopes.includes(snapshot.scope) && !blockedScopes.includes(snapshot.scope) && (
          <p className="intent-scope-bar__hint" role="status" style={{ color: "var(--fc-warn, #92400e)", fontSize: "0.78rem" }}>
            ⚠ Scope partially unavailable — data may be incomplete
          </p>
        )}
      </div>

      <div className="intent-scope-bar__group">
        <label htmlFor="fc-mode">Mode</label>
        <select id="fc-mode" value={snapshot.mode} onChange={handleMode}>
          {ALL_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>

      {intentScope.historyDepth > 0 && (
        <button
          className="intent-scope-bar__back"
          onClick={handleBack}
          aria-label={i18n.t("ui.back")}
        >
          ← {i18n.t("ui.back")}
        </button>
      )}

      {!intentScope.scopeMatchesIntent && (
        <p className="intent-scope-bar__hint" role="status">
          Suggested: {SCOPE_LABELS[intentScope.suggestedScope]}
        </p>
      )}

      {/* ── U3: Scope degradation warning banner ──────────────────────────── */}
      {showDegradation && degradedFrom && degradedTo && (
        <div
          className="intent-scope-bar__degrade-banner"
          role="alert"
          aria-live="polite"
          style={{
            width: "100%",
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            background: "var(--fc-warn-bg, #fefce8)",
            border: "1px solid var(--fc-warn, #f59e0b)",
            borderRadius: "0.375rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            fontSize: "0.82rem",
            color: "var(--fc-text, #111)",
          }}
        >
          <span>
            ⚠️ Scope narrowed from{" "}
            <strong>{SCOPE_LABELS[degradedFrom]}</strong> to{" "}
            <strong>{SCOPE_LABELS[degradedTo]}</strong> — some insights may be incomplete.
          </span>
          <button
            type="button"
            className="intent-scope-bar__restore-btn"
            onClick={handleRestoreScope}
            style={{
              padding: "0.2rem 0.6rem",
              border: "1px solid var(--fc-warn, #f59e0b)",
              borderRadius: "0.25rem",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.78rem",
              color: "var(--fc-text, #111)",
            }}
          >
            Restore full scope
          </button>
          <button
            type="button"
            aria-label="Dismiss scope degradation warning"
            onClick={dismissDegradation}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              color: "var(--fc-text-muted)",
            }}
          >
            ×
          </button>
        </div>
      )}
    </nav>
  );
}
