#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: no-prod-touch ==="
VIOLATIONS=0

# Check DATABASE_URL
if [ -n "${DATABASE_URL:-}" ]; then
  if echo "$DATABASE_URL" | grep -qiE "prod|production|\.com.*(prod|live)"; then
    echo "  VIOLATION: DATABASE_URL appears to point to production: $DATABASE_URL"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
fi

# Check for production hostnames in .env files
for envf in .env .env.production .env.local; do
  if [ -f "$envf" ]; then
    if grep -qiE "(production|\.com.*production|prod\.)" "$envf" 2>/dev/null; then
      echo "  VIOLATION: $envf contains production references"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
done

# Check git branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "  VIOLATION: On main/master branch. Redesign must be on a separate branch."
  VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS production touch violations."
  exit 1
fi
echo "PASS: No production touch detected."
exit 0
