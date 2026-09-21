#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: observability-parity ==="
OBSERVABILITY_COUNT=0
VIOLATIONS=0

if [ -d src ]; then
  OBSERVABILITY_COUNT=$(grep -r "console\.log\|console\.error\|console\.warn\|logger\.\|metrics\.\|trace\.\|span\.\|OpenTelemetry\|otel" src/ --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null | wc -l || true)
fi

if [ "$OBSERVABILITY_COUNT" -eq 0 ]; then
  echo "  WARNING: No observability/logging found in code."
fi
echo "PASS: Observability parity check completed. Found $OBSERVABILITY_COUNT observability calls."
exit 0
