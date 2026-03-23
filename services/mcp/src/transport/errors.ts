// ─── MCP Transport Errors ─────────────────────────────────────────────────────
//
// Typed error codes surfaced over HTTP. All errors carry an RFC 7807-style
// `code` string for machine-readable identification.

export type McpErrorCode =
  | "TOOL_NOT_FOUND"
  | "INVALID_REQUEST"
  | "CONTEXT_INVALID"
  | "TOOL_EXECUTION_FAILED"
  | "INTERNAL_ERROR"
  /** Phase 7: live billing adapter stub — provider SDK not yet integrated. */
  | "LIVE_BILLING_NOT_IMPLEMENTED"
  /** Phase 12: workspace scope enforcement. */
  | "WORKSPACE_SCOPE_DENIED";

export interface McpErrorBody {
  code: McpErrorCode;
  message: string;
  toolId?: string;
  requestId?: string;
  detail?: unknown;
}

export function makeError(
  code: McpErrorCode,
  message: string,
  extras?: Pick<McpErrorBody, "toolId" | "requestId" | "detail">
): { error: McpErrorBody } {
  return { error: { code, message, ...extras } };
}
