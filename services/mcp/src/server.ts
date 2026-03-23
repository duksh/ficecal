// ─── FiceCal MCP Service — Fastify server ─────────────────────────────────────
//
// Phase 5: HTTP transport for @ficecal/mcp-tooling economics tools.
// ADR-0002: Fastify + MCP SDK transport stack.
//
// Exposed routes (all under /mcp/v1):
//   GET  /health         — liveness
//   GET  /capabilities   — McpCapabilitiesManifest
//   POST /tools/:id/call — McpToolEnvelope → McpToolResult

import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerMcpRoutes } from "./transport/index.js";
import { initializeCatalog } from "./transport/registry.js";

// Render.com injects PORT; MCP_PORT is the local-dev override.
// HOST must be 0.0.0.0 in production so the platform router can reach the process.
const PORT = Number(process.env["PORT"] ?? process.env["MCP_PORT"] ?? 4001);
const HOST = process.env["MCP_HOST"] ?? (process.env["NODE_ENV"] === "production" ? "0.0.0.0" : "127.0.0.1");
const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";

/**
 * Build and configure the Fastify application.
 * Extracted from listen() so tests can inject without binding a port.
 */
export async function buildApp() {
  // Disable pretty logging in test/non-interactive environments
  const usePretty =
    process.env["NODE_ENV"] !== "production" &&
    process.env["NODE_ENV"] !== "test" &&
    process.stdout.isTTY === true;

  const app = Fastify({
    logger: usePretty
      ? { level: LOG_LEVEL, transport: { target: "pino-pretty", options: { colorize: true } } }
      : { level: process.env["NODE_ENV"] === "test" ? "silent" : LOG_LEVEL },
  });

  // ── CORS (dev-permissive; tighten in production via env) ──────────────────
  await app.register(cors, {
    origin: process.env["CORS_ORIGIN"] ?? true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  // ── Content-type enforcement ───────────────────────────────────────────────
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      const e = Object.assign(
        err instanceof Error ? err : new Error("JSON parse error"),
        { statusCode: 400 }
      );
      done(e as Error, undefined);
    }
  });

  // ── Pricing oracle bootstrap ───────────────────────────────────────────────
  // Must run before registerMcpRoutes (which calls getToolRegistry()) so that
  // module-level catalog variables are populated before the registry is built.
  await initializeCatalog();

  // ── MCP routes ────────────────────────────────────────────────────────────
  await registerMcpRoutes(app);

  // ── 404 fallback ─────────────────────────────────────────────────────────
  app.setNotFoundHandler((_req, reply) => {
    return reply.code(404).send({
      error: { code: "NOT_FOUND", message: "No route matched. See GET /mcp/v1/capabilities." },
    });
  });

  return app;
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Only run when executed directly (not imported by tests).

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));

if (isMain) {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`@ficecal/service-mcp listening on http://${HOST}:${PORT}`);
    app.log.info("Routes: GET /mcp/v1/health | GET /mcp/v1/capabilities | POST /mcp/v1/tools/:id/call");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ── Pricing catalog refresh ────────────────────────────────────────────────
  const refreshMs = Number(process.env["MCP_CATALOG_REFRESH_INTERVAL_MS"] ?? 21_600_000);
  if (refreshMs > 0) {
    setInterval(async () => {
      app.log.info(`[ficecal:catalog] refreshing pricing catalog…`);
      try {
        await initializeCatalog();
        app.log.info(`[ficecal:catalog] pricing catalog refreshed successfully`);
      } catch (err) {
        app.log.warn(`[ficecal:catalog] pricing catalog refresh failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, refreshMs).unref(); // .unref() so the timer doesn't prevent process exit
  }
}
