#!/usr/bin/env bash
# ─── FiceCal v2 — concurrent dev launcher ─────────────────────────────────────
#
# Starts both services needed for local development:
#   MCP service   — port 4001 (default)  @ficecal/service-mcp
#   Web app       — port 4321 (default)  apps/web (Vite)
#
# Usage:
#   ./scripts/dev.sh            # start both
#   MCP_PORT=4002 ./scripts/dev.sh   # override MCP port
#
# Requires: pnpm, bash 4+
# Both processes are killed when the script exits (Ctrl-C).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

MCP_DIR="$ROOT_DIR/services/mcp"
WEB_DIR="$ROOT_DIR/apps/web"

MCP_PORT="${MCP_PORT:-4001}"
WEB_PORT="${WEB_PORT:-4321}"

# Colour helpers (no-op if terminal doesn't support them)
BOLD="\033[1m"
CYAN="\033[36m"
YELLOW="\033[33m"
RESET="\033[0m"

log() { echo -e "${BOLD}${CYAN}[ficecal:dev]${RESET} $*"; }

# ── Pre-flight ─────────────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install via: npm install -g pnpm" >&2
  exit 1
fi

if [[ ! -d "$MCP_DIR" ]]; then
  echo "ERROR: $MCP_DIR not found. Run from the monorepo root." >&2
  exit 1
fi

if [[ ! -d "$WEB_DIR" ]]; then
  echo "ERROR: $WEB_DIR not found. Run from the monorepo root." >&2
  exit 1
fi

# ── Cleanup on exit ────────────────────────────────────────────────────────────
MCP_PID=""
WEB_PID=""

cleanup() {
  echo ""
  log "Shutting down…"
  [[ -n "$MCP_PID" ]] && kill "$MCP_PID" 2>/dev/null && log "MCP service stopped (PID $MCP_PID)"
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null && log "Web app stopped (PID $WEB_PID)"
  exit 0
}
trap cleanup INT TERM EXIT

# ── Launch MCP service ─────────────────────────────────────────────────────────
log "Starting ${YELLOW}@ficecal/service-mcp${RESET} on port ${MCP_PORT}…"
MCP_PORT="$MCP_PORT" pnpm --filter @ficecal/service-mcp dev 2>&1 | \
  sed "s/^/${BOLD}[mcp]${RESET} /" &
MCP_PID=$!

# ── Launch web app ─────────────────────────────────────────────────────────────
log "Starting ${YELLOW}apps/web${RESET} on port ${WEB_PORT}…"
VITE_MCP_BASE_URL="http://localhost:${MCP_PORT}" \
  pnpm --filter @ficecal/web dev --port "$WEB_PORT" 2>&1 | \
  sed "s/^/${BOLD}[web]${RESET} /" &
WEB_PID=$!

# ── Status ─────────────────────────────────────────────────────────────────────
log "Both services started."
log "  MCP  → http://localhost:${MCP_PORT}/mcp/v1/health"
log "  Web  → http://localhost:${WEB_PORT}"
log "Press Ctrl-C to stop."

# Wait for either child to exit
wait -n 2>/dev/null || wait
