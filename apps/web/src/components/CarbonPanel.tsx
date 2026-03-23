// ─── CarbonPanel ──────────────────────────────────────────────────────────────
//
// Phase 11 / FinOps Framework 2026 Sustainability capability.
// Calls sustainability.carbon.estimate MCP tool to show operational carbon
// footprint for the current workspace context and up to 3 lower-carbon region
// alternatives.

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

// ── Output types ──────────────────────────────────────────────────────────────

interface LowCarbonAlternative {
  regionCode: string;
  regionName: string;
  intensityGCo2ePerKwh: number;
  estimatedCarbonKgCo2e: string;
  carbonReductionPercent: number;
  renewableCommitment: boolean;
}

interface CarbonOutput {
  provider: string;
  regionCode: string;
  regionName: string;
  workloadType: string;
  quantity: number;
  computeUnit: string;
  energyKwh: string;
  carbonKgCo2e: string;
  carbonTonnesCo2e: string;
  intensityGCo2ePerKwh: number;
  pue: number;
  renewableCommitment: boolean;
  alternatives?: LowCarbonAlternative[];
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: CarbonOutput }
  | { status: "error"; message: string };

interface Props {
  context: SharedContext;
}

const PROVIDERS = ["aws", "gcp", "azure"];
const WORKLOAD_TYPES = [
  { value: "compute", label: "Compute (VMs)" },
  { value: "storage", label: "Storage" },
  { value: "networking", label: "Networking" },
  { value: "ml_training", label: "ML Training" },
  { value: "ml_inference", label: "ML Inference" },
];

export function CarbonPanel({ context }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [provider, setProvider] = useState("aws");
  const [region, setRegion] = useState("us-east-1");
  const [workload, setWorkload] = useState("compute");
  const [quantity, setQuantity] = useState("100");

  const runEstimate = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await callTool<CarbonOutput>("sustainability.carbon.estimate", {
        provider,
        regionCode: region,
        workloadType: workload,
        quantity: Number(quantity),
        includeAlternatives: true,
      });
      setState({ status: "ok", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [provider, region, workload, quantity]);

  return (
    <div className="panel-stack">
      <section className="panel" aria-label="Carbon footprint estimator">
        <h2>🌱 Carbon Footprint</h2>
        <p className="hint" style={{ color: "var(--fc-text-muted)", marginBottom: "1rem", fontSize: "0.85rem" }}>
          Estimate operational CO₂e emissions for your cloud workload.
          FinOps Framework 2026 — Sustainability capability.
        </p>

        {/* ── Inputs ─────────────────────────────────────────────────────── */}
        <div className="form-row" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <label className="field-group" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="field-label">Provider</span>
            <select
              className="form-select"
              value={provider}
              onChange={e => setProvider(e.target.value)}
            >
              {PROVIDERS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </label>

          <label className="field-group" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="field-label">Region</span>
            <input
              className="form-input"
              value={region}
              onChange={e => setRegion(e.target.value)}
              placeholder="e.g. us-east-1"
              style={{ width: "10rem" }}
            />
          </label>

          <label className="field-group" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="field-label">Workload Type</span>
            <select
              className="form-select"
              value={workload}
              onChange={e => setWorkload(e.target.value)}
            >
              {WORKLOAD_TYPES.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>

          <label className="field-group" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="field-label">Quantity (vCPU-hours)</span>
            <input
              className="form-input"
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              style={{ width: "7rem" }}
            />
          </label>
        </div>

        <button
          className="run-btn"
          onClick={runEstimate}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? "Estimating…" : "Estimate Carbon Footprint"}
        </button>

        {/* ── Results ────────────────────────────────────────────────────── */}
        {state.status === "error" && (
          <p className="hint" style={{ color: "var(--fc-crit)", marginTop: "0.75rem" }}>
            ⚠ {state.message}
          </p>
        )}

        {state.status === "ok" && (
          <div style={{ marginTop: "1.25rem" }}>
            <div className="status-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
              <div className="metric-card">
                <div className="metric-value" style={{ color: "var(--fc-ok)", fontSize: "1.5rem", fontWeight: 700 }}>
                  {Number(state.data.carbonKgCo2e).toFixed(2)} kg
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>CO₂e emitted</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {state.data.intensityGCo2ePerKwh} g
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>
                  CO₂e/kWh — {state.data.regionName}
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                  {Number(state.data.energyKwh).toFixed(2)} kWh
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>Energy consumed</div>
              </div>
              <div className="metric-card">
                <div className="metric-value" style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                  {state.data.renewableCommitment ? "✅ Renewable" : "⚡ Grid mix"}
                </div>
                <div className="metric-label" style={{ color: "var(--fc-text-muted)", fontSize: "0.78rem" }}>Energy source</div>
              </div>
            </div>

            {/* ── Greener alternatives ──────────────────────────────────── */}
            {state.data.alternatives && state.data.alternatives.length > 0 && (
              <div>
                <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "var(--fc-text-muted)" }}>
                  🌍 Lower-carbon regions
                </h3>
                <ul className="status-list" style={{ gap: "0.4rem" }}>
                  {state.data.alternatives.slice(0, 3).map(alt => (
                    <li key={alt.regionCode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <code style={{ fontSize: "0.82rem" }}>{alt.regionCode}</code>
                        {" "}<span style={{ color: "var(--fc-text-muted)", fontSize: "0.8rem" }}>{alt.regionName}</span>
                        {alt.renewableCommitment && (
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "var(--fc-ok)" }}>♻ renewable</span>
                        )}
                      </div>
                      <span style={{ color: "var(--fc-ok)", fontWeight: 600, fontSize: "0.85rem" }}>
                        −{alt.carbonReductionPercent.toFixed(0)}% CO₂e
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p style={{ fontSize: "0.75rem", color: "var(--fc-text-muted)", marginTop: "0.75rem" }}>
              PUE: {state.data.pue} · Workload: {state.data.workloadType} ·
              Scope 2 emissions · FinOps Framework 2026 Sustainability
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
