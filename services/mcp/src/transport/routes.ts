// ─── MCP Fastify Routes ───────────────────────────────────────────────────────
//
// Three route groups mounted at /mcp/v1:
//
//   GET  /mcp/v1/health                 → service liveness check
//   GET  /mcp/v1/capabilities           → tool manifest (per McpCapabilitiesManifest)
//   POST /mcp/v1/tools/:toolId/call     → tool invocation
//
// All tool calls carry the full McpToolEnvelope and return McpToolResult.

import type { FastifyInstance } from "fastify";
import { getToolRegistry, getPluginHost, getWorkspaceRegistry } from "./registry.js";
import { buildRequestContext } from "./context.js";
import { makeError } from "./errors.js";

export async function registerMcpRoutes(app: FastifyInstance): Promise<void> {
  const BASE = "/mcp/v1";

  // ── Health ──────────────────────────────────────────────────────────────────

  app.get(`${BASE}/health`, async (_req, reply) => {
    const registry    = getToolRegistry();
    const pluginHost  = getPluginHost();
    const plugins     = pluginHost?.listPluginEntries() ?? [];
    const sandboxed   = pluginHost?.sandbox !== null && pluginHost?.sandbox !== undefined;

    return reply.code(200).send({
      status: "ok",
      service: "@ficecal/service-mcp",
      version: "0.15.0",
      phase: 12,
      toolCount:   registry.list().length,
      namespaces:  registry.namespaces(),
      pluginCount: plugins.length,
      plugins:     plugins.map((e) => ({
        id:      e.plugin.id,
        version: e.plugin.version,
        enabled: e.enabled,
        verified: e.plugin.manifest !== undefined,
      })),
      sandbox: {
        active: sandboxed,
        timeoutMs: sandboxed ? ((pluginHost?.sandbox as unknown) as { timeoutMs?: number })?.timeoutMs ?? 5000 : null,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ── Capabilities ────────────────────────────────────────────────────────────

  app.get(`${BASE}/capabilities`, async (_req, reply) => {
    const registry = getToolRegistry();
    const manifest = registry.getCapabilities({
      mcpVersion: "2.0",
      schemaVersion: new Date().toISOString().slice(0, 10),
      legacyAliasesEnabled: false,
    });
    return reply.code(200).send(manifest);
  });

  // ── Tool call ───────────────────────────────────────────────────────────────

  app.post<{
    Params: { toolId: string };
    Body: {
      input: unknown;
      timeRange?: { start?: string; end?: string; tz?: string };
      featureFlags?: string[];
      contractVersions?: { mcp?: string; tool?: string; fixture?: string };
    };
  }>(`${BASE}/tools/:toolId/call`, async (req, reply) => {
    const { toolId } = req.params;
    const registry = getToolRegistry();

    // Lookup tool
    const tool = registry.lookup(toolId);
    if (!tool) {
      return reply
        .code(404)
        .send(makeError("TOOL_NOT_FOUND", `Tool '${toolId}' is not registered`, { toolId }));
    }

    // Build context from request headers + body metadata
    const context = buildRequestContext(
      req.headers as Parameters<typeof buildRequestContext>[0],
      {
        timeRange: req.body?.timeRange,
        featureFlags: req.body?.featureFlags,
        contractVersions: req.body?.contractVersions,
      }
    );

    // ── Workspace-scoped billing enforcement (Gap P4) ────────────────────────
    // Gate: FICECAL_WORKSPACE_SCOPING=1
    // When enabled, billing-namespace tools require the workspace to have at
    // least one billing plugin enabled in WorkspaceRegistry.
    if (
      process.env["FICECAL_WORKSPACE_SCOPING"] === "1" &&
      tool.namespace === "billing"
    ) {
      const { workspaceId } = context;
      const workspaceRegistry = getWorkspaceRegistry();
      if (workspaceRegistry !== null && workspaceId) {
        // Billing plugin IDs registered in the PluginHost
        const BILLING_PLUGIN_IDS = [
          "@ficecal/billing-aws",
          "@ficecal/billing-gcp",
          "@ficecal/billing-azure",
          "@ficecal/billing-openai",
        ];
        const hasAccess = BILLING_PLUGIN_IDS.some((pluginId) =>
          workspaceRegistry.isPluginEnabledForWorkspace(workspaceId, pluginId),
        );
        if (!hasAccess) {
          return reply.code(403).send(
            makeError(
              "WORKSPACE_SCOPE_DENIED",
              "Tool not available for this workspace",
              { toolId, detail: { workspaceId } },
            ),
          );
        }
      }
    }

    if (!req.body?.input || typeof req.body.input !== "object") {
      return reply.code(400).send(
        makeError("INVALID_REQUEST", "Request body must include an 'input' object", {
          toolId,
          requestId: context.requestId,
        })
      );
    }

    // Execute tool
    try {
      const result = await tool.handler({ context, input: req.body.input });
      return reply.code(200).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      // ── 501 Not Implemented — live billing stub (Phase 7) ────────────────
      // Billing adapters with ingestMode: "live" throw an error with
      // code: "LIVE_BILLING_NOT_IMPLEMENTED" and httpStatus: 501 until
      // the real provider SDK is integrated in Phase 8.
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === "LIVE_BILLING_NOT_IMPLEMENTED"
      ) {
        return reply.code(501).send(
          makeError("LIVE_BILLING_NOT_IMPLEMENTED", message, {
            toolId,
            requestId: context.requestId,
            detail: "Phase 7 stub — Phase 8 will integrate the provider SDK",
          }),
        );
      }

      return reply.code(500).send(
        makeError("TOOL_EXECUTION_FAILED", message, {
          toolId,
          requestId: context.requestId,
          detail: err instanceof Error ? err.stack : undefined,
        })
      );
    }
  });
}
