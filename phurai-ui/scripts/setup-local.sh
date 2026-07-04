#!/usr/bin/env bash
# =============================================================================
# setup-local.sh — Phurai Local Dev Setup (macOS / Linux / WSL2)
#
# Usage:  bash scripts/setup-local.sh
#
# What this does:
#   1. Builds & starts the local MSSQL container
#   2. Waits until SQL Server is healthy (up to 120s)
#   3. Seeds the database from database/System_Restaurant.sql
#   4. Starts the full app stack (backend + frontend)
# =============================================================================

set -e

# ── Config ──────────────────────────────────────────────────────────────────
SA_PASSWORD="PhuraiLocal@2026"
SQL_FILE="database/System_Restaurant.sql"
CONTAINER="phurai-mssql"
MAX_WAIT=120   # seconds

# ── Colours ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Pre-flight checks ────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || error "Docker is not installed."
docker compose version >/dev/null 2>&1 || error "docker compose (v2) is required. Run: docker compose version"
[[ -f "$SQL_FILE" ]] || error "SQL file not found: $SQL_FILE"

info "=== Phurai Local Dev Setup ==="

# ── Step 1: Start only the DB container ─────────────────────────────────────
info "Step 1/4 — Starting MSSQL container..."
docker compose --profile local up -d db

# ── Step 2: Wait for healthy ─────────────────────────────────────────────────
info "Step 2/4 — Waiting for SQL Server to be healthy (max ${MAX_WAIT}s)..."
elapsed=0
while true; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "missing")
  if [[ "$STATUS" == "healthy" ]]; then
    info "SQL Server is healthy! ✅"
    break
  fi
  if [[ $elapsed -ge $MAX_WAIT ]]; then
    warn "Timed out waiting for SQL Server. Checking logs..."
    docker logs "$CONTAINER" --tail 20
    error "SQL Server did not become healthy in ${MAX_WAIT}s."
  fi
  echo -n "."
  sleep 5
  elapsed=$((elapsed + 5))
done
echo ""

# ── Step 3: Seed the database ────────────────────────────────────────────────
info "Step 3/4 — Seeding database from $SQL_FILE..."
docker cp "$SQL_FILE" "$CONTAINER":/tmp/System_Restaurant.sql

docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$SA_PASSWORD" -C \
  -i /tmp/System_Restaurant.sql \
  -b  2>&1 | grep -v "^Changed database" | tail -20

# Verify tables were created
TABLE_COUNT=$(docker exec "$CONTAINER" /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$SA_PASSWORD" -C \
  -Q "USE System_Restaurant; SELECT COUNT(*) FROM sys.tables;" \
  -h -1 2>/dev/null | tr -d ' \r\n')

if [[ "$TABLE_COUNT" -ge 30 ]]; then
  info "Database seeded successfully! $TABLE_COUNT tables created ✅"
else
  warn "Expected 30+ tables but got: $TABLE_COUNT. Check SQL output above."
fi

# ── Step 4: Start the full stack ─────────────────────────────────────────────
info "Step 4/4 — Starting full stack (app + db)..."
docker compose --profile local up -d

info ""
info "=== Setup complete! ==="
info "App running at: http://localhost:5001"
info ""
info "Useful commands:"
info "  View logs:   docker logs phurai-app-local -f"
info "  Stop all:    docker compose --profile local down"
info "  Reset DB:    docker compose --profile local down -v && bash scripts/setup-local.sh"
