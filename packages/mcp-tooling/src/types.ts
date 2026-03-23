// ─── MCP protocol context (compatible with services/mcp/src/mcp/types.ts) ───

export type McpMode = "quick" | "operator" | "architect";
export type McpActor = "human" | "agent" | "system";

export interface McpTimeRange {
  start: string; // ISO date
  end: string;   // ISO date
  tz: string;    // IANA timezone
}

export interface McpContractVersions {
  mcp: string;
  tool: string;
  fixture: string;
}

export interface McpRequestContext {
  requestId: string;
  traceId: string;
  mode: McpMode;
  workspaceId: string;
  actor: McpActor;
  timeRange: McpTimeRange;
  contractVersions: McpContractVersions;
  featureFlags: string[];
}

export interface McpToolEnvelope<TInput> {
  context: McpRequestContext;
  input: TInput;
}

// ─── Tool descriptor ──────────────────────────────────────────────────────────

/**
 * A JSON Schema property descriptor (recursive to support nested objects/arrays).
 */
export interface McpJsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  /** For type "array": element schema. */
  items?: McpJsonSchemaProperty | { type: string; properties?: Record<string, McpJsonSchemaProperty>; required?: string[] };
  /** For type "object": child properties. */
  properties?: Record<string, McpJsonSchemaProperty>;
  required?: string[];
}

/**
 * JSON Schema-compatible type for documenting tool input shapes.
 * Supports nested objects and arrays for complex tool inputs.
 */
export interface McpToolInputSchema {
  type: "object";
  properties: Record<string, McpJsonSchemaProperty>;
  required: string[];
}

/**
 * Descriptor for a registerable MCP tool.
 *
 * Tools are the units of capability exposed over the MCP protocol.
 * Each tool is registered in the McpToolRegistry and surfaced via
 * the capabilities endpoint.
 */
export interface McpToolDescriptor<TInput = unknown, TOutput = unknown> {
  /** Unique tool id. Convention: `<namespace>.<verb>.<noun>` */
  id: string;

  /** Human-readable tool name. */
  name: string;

  /** Description shown to agents consuming the MCP capabilities manifest. */
  description: string;

  /** Namespace grouping (e.g. "economics", "billing", "health"). */
  namespace: string;

  /** Stability level — drives capability manifest surfacing. */
  stability: "stable" | "beta" | "experimental";

  /** JSON Schema for the tool's input payload. */
  inputSchema: McpToolInputSchema;

  /**
   * Pure handler function: takes an envelope (context + input) and
   * returns a typed result. Injected at registration time.
   */
  handler: (envelope: McpToolEnvelope<TInput>) => Promise<McpToolResult<TOutput>>;
}

// ─── Tool result ─────────────────────────────────────────────────────────────

export interface McpToolResult<TOutput> {
  /** The tool output payload. */
  output: TOutput;

  /** Traceability: which tool produced this result. */
  toolId: string;

  /** ISO timestamp of execution. */
  executedAt: string;

  /** Mirrors the requestId from the envelope context for correlation. */
  requestId: string;

  /** Non-fatal warnings produced during execution. */
  warnings: string[];

  /** Formula or rule IDs applied (for auditability). */
  appliedIds: string[];
}

// ─── Capabilities manifest ───────────────────────────────────────────────────

export interface McpToolNamespaceManifest {
  namespace: string;
  version: string;
  tools: string[]; // tool ids
  ownerTeam: string;
  stability: string;
}

export interface McpCapabilitiesManifest {
  mcpVersion: string;
  schemaVersion: string;
  toolNamespaces: McpToolNamespaceManifest[];
  compatibility: {
    legacyAliasesEnabled: boolean;
    aliasNamespace: string;
    parityFixtureVersion: string;
  };
  featureFlags: string[];
}
