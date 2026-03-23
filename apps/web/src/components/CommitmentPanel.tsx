// ─── CommitmentPanel ──────────────────────────────────────────────────────────
//
// FOCUS 1.3 CommitmentDiscount capability — surfaces billing.commitment.status
// MCP tool output. Shows RI/Savings Plan utilisation, wasted spend, and
// coverage across AWS, GCP, and Azure.

/// <reference types="vite/client" />
import { useState, useCallback } from "react";
import type { SharedContext } from "../types.js";

const MCP_BASE: string =
  (import.meta.env?.VITE_MCP_BASE_URL as string | undefined) ?? "http://localhost:4001";

async function callTool<T>(toolId: string, input: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${MCP_BASE}/mcp/v1/tools/${encodeURIComponent(toolId)}/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolId, requestId: `web-${toolId}-${Date.now()}`, input }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (body.error as Record<string, unknown>)?.message ?? `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  const data = await res.json() as { output: T };
  return data.output;
}

// ── Output types (mirrors BillingCommitmentStatusOutput) ─────────────────────

interface CommitmentRecord {
  commitmentDiscountId: string;
  commitmentDiscountName?: string;
  commitmentDiscountType: string;
  commitmentDiscountStatus: "used" | "unused" | "partial";
  commitmentDiscountCategory?: string;
  commitmentDiscountQuantity?: number;
  commitmentDiscountUnit?: string;
  chargeAmount: string;
  unusedChargeAmount?: string;
  coveragePercent?: number;
  providerName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}

interface CommitmentSummary {
  totalCount: number;
  usedCount: number;
  unusedCount: number;
  partialCount: number;
  totalCommitmentSpend: string;
  totalUnusedSpend: string;
  overallUtilisationPercent: number;
  currency: string;
}

interface CommitmentOutput {
  provider: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  commitments: CommitmentRecord[];
  summary: CommitmentSummary;
  ingestMode: string;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: CommitmentOutput }
  | { status: "error"; message: string };

interface Props {
  context: SharedContext;
}

const PROVIDERS = ["aws", "gcp", "azure"];

const STATUS_COLOUR: Record<string, string> = {
  used: "var(--fc-ok)",
  partial: "var(--fc-warn)",
  unused: "var(--fc-crit)",
};

export function CommitmentPanel({ context }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [provider, setProvider] = useState("aws");

  const run = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await callTool<CommitmentOutput>("billing.commitment.status", {
        provider,
        periodStart: context.startDate,
        periodEnd: context.endDate,
      });
      setState({ status: "ok", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [provider, context.startDate, context.endDate]);

  const utilisationColour = (pct: number) =>
    pct >= 80 ? "var(--fc-ok)" : pct >= 50 ? "var(--fc-warn)" : "var(--fc-crit)";

  return (
    <div className="panel-stack">
      <section className="panel" aria-label="Commitment discount management">
        <h2>🎯 Commitment Management</h2>
        <p className="hint" style={{ color: "var(--fc-text-muted)", marginBottom: "1rem", fontSize: "0.85rem" }}>
          Reserved Instance and Savings Plan utilisation — FOCUS 1.3 CommitmentDiscount columns.
        </p>

        {/* ── Controls ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1rem", flexWrap: "wrap" }}>
          <label className="field-group" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="field-label">Provider</span>
            <select className="form-select" value={provider} onChange={e => setProvider(e.target.value)}>
              {PROVIDERS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </label>
          <div style={{ color: "var(--fc-text-muted)", fontSize: "0.8rem", paddingBottom: "0.3rem" }}>
            {context.startDate} → {context.endDate}
          </div>
          <button className="run-btn" onClick={run} disabled={state.status === "loading"}>
            {state.status === "loading" ? "Loading…" : "Load Commitments"}
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {state.status === "error" && (
          <p className="hint" style={{ color: "var(--fc-crit)" }}>⚠ {state.message}</p>
        )}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {state.status === "ok" && (
          <>
            {/* Summary KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div className="metric-card">
                <div className="metric-value" style={{ color: utilisationColour(state.data.summary.overallUtilisationPercent), fontSize: "1.6rem", fontWeight: 700 }}>
                  {state.data.summary.overallUtilisationPercent.toFixed(1)}%
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>Utilisation</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                  {state.data.currency} {Number(state.data.summary.totalCommitmentSpend).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>Total commitment spend</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ color: "var(--fc-crit)", fontSize: "1.3rem", fontWeight: 700 }}>
                  {state.data.currency} {Number(state.data.summary.totalUnusedSpend).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>Unused (wasted)</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                  {state.data.summary.usedCount} used · {state.data.summary.unusedCount} unused
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>of {state.data.summary.totalCount} commitments</div>
              </div>
            </div>

            {/* Commitment records table */}
            {state.data.commitments.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--fc-border)", color: "var(--fc-text-muted)" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Commitment</th>
                      <th style={{ textAlign: "left", padding: "0.4rem 0.6rem" }}>Type</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.6rem" }}>Charge</th>
                      <th style={{ textAlign: "right", padding: "0.4rem 0.6rem" }}>Unused</th>
                      <th style={{ textAlign: "center", padding: "0.4rem 0.6rem" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.commitments.slice(0, 10).map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--fc-border)" }}>
                        <td style={{ padding: "0.4rem 0.6rem" }}>
                          <code style={{ fontSize: "0.78rem" }}>{c.commitmentDiscountId}</code>
                          {c.commitmentDiscountName && (
                            <div style={{ color: "var(--fc-text-muted)", fontSize: "0.74rem" }}>{c.commitmentDiscountName}</div>
                          )}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", color: "var(--fc-text-muted)" }}>{c.commitmentDiscountType}</td>
                        <td style={{ padding: "0.4rem 0.6rem", textAlign: "right", fontFamily: "var(--fc-mono)" }}>
                          {Number(c.chargeAmount).toFixed(2)}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", textAlign: "right", fontFamily: "var(--fc-mono)", color: c.unusedChargeAmount && Number(c.unusedChargeAmount) > 0 ? "var(--fc-crit)" : "var(--fc-text-muted)" }}>
                          {c.unusedChargeAmount ? Number(c.unusedChargeAmount).toFixed(2) : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", textAlign: "center" }}>
                          <span style={{ color: STATUS_COLOUR[c.commitmentDiscountStatus] ?? "var(--fc-text-muted)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {c.commitmentDiscountStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {state.data.commitments.length > 10 && (
                  <p style={{ fontSize: "0.75rem", color: "var(--fc-text-muted)", marginTop: "0.4rem" }}>
                    Showing 10 of {state.data.commitments.length} commitments · {state.data.ingestMode} mode
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {state.status === "idle" && (
          <p className="hint" style={{ color: "var(--fc-text-muted)", fontSize: "0.82rem" }}>
            Select a provider and run to see RI / Savings Plan utilisation for {context.startDate} → {context.endDate}.
          </p>
        )}
      </section>
    </div>
  );
}
