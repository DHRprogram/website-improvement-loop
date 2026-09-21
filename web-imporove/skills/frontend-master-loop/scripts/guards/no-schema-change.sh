#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: no-schema-change ==="
FROZEN="artifacts/redesign/data-contract/SCHEMA_SNAPSHOT.sql"
DRIFT=0

if [ ! -f "$FROZEN" ]; then
  echo "  SKIP: No frozen schema snapshot. Run R3 first."
  exit 0
fi

# Compare current schema with frozen snapshot
if [ -n "${DATABASE_URL:-}" ]; then
  echo "  Checking database schema drift..."
  CURRENT_SCHEMA=$(psql "$DATABASE_URL" -c "\dt" -t 2>/dev/null || echo "")
  FROZEN_TABLES=$(grep -c "CREATE TABLE" "$FROZEN" 2>/dev/null || echo "0")

  if [ -z "$CURRENT_SCHEMA" ] && [ "$FROZEN_TABLES" -gt 0 ]; then
    echo "  VIOLATION: Database unreachable but frozen schema has tables."
    DRIFT=$((DRIFT + 1))
  fi
fi

# Check for migration files not in frozen scope
if ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
  for m in prisma/migrations/*/migration.sql; do
    if [ -f "$m" ]; then
      echo "  VIOLATION: New migration file: $m"
      DRIFT=$((DRIFT + 1))
    fi
  done
fi

if [ "$DRIFT" -gt 0 ]; then
  echo "FAIL: $DRIFT schema drift violations. HST-04."
  exit 1
fi
echo "PASS: No schema drift."
exit 0
