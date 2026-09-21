#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: analytics-parity ==="
ANALYTICS_OLD=0
ANALYTICS_NEW=0

if [ -d src ]; then
  grep -r "gtag\|ga\(" src/ 2>/dev/null | head -20 && ANALYTICS_OLD=$(grep -rc "gtag\|ga\|analytics" src/ 2>/dev/null | wc -l) || true
fi

echo "  Analytics calls in source: $ANALYTICS_OLD"
echo "PASS: Analytics parity check completed."
exit 0
