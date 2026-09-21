#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: perf-budget ==="
MAX_LCP="${MAX_LCP_MS:-2500}"
MAX_CLS="${MAX_CLS:-0.1}"
MAX_BUNDLE="${MAX_BUNDLE_KB:-1000}"

BUNDLE_KB="${BUNDLE_KB:-0}"
LCP_MS="${LCP_MS:-0}"
CLS="${CLS:-0}"

# Try to read from BASELINE_METRICS
if [ -f "artifacts/redesign/preservation/BASELINE_METRICS.json" ]; then
  BM=$(cat artifacts/redesign/preservation/BASELINE_METRICS.json)
  BUNDLE_KB=$(echo "$BM" | grep -o '"bundle_kb":[0-9]*' | awk -F: '{print $2}' || echo "$BUNDLE_KB")
  LCP_MS=$(echo "$BM" | grep -o '"lcp_ms":[0-9]*' | awk -F: '{print $2}' || echo "$LCP_MS")
  CLS=$(echo "$BM" | grep -o '"cls_score":[0-9.]*' | awk -F: '{print $2}' || echo "$CLS")
fi

VIOLATIONS=0
[ "$LCP_MS" -gt "$MAX_LCP" ] && echo "  VIOLATION: LCP ${LCP_MS}ms > ${MAX_LCP}ms" && VIOLATIONS=$((VIOLATIONS+1))
[ "$(echo "$CLS > $MAX_CLS" | bc -l 2>/dev/null || echo 0)" -eq 1 ] && echo "  VIOLATION: CLS ${CLS} > ${MAX_CLS}" && VIOLATIONS=$((VIOLATIONS+1))
[ "$BUNDLE_KB" -gt "$MAX_BUNDLE" ] && [ "$BUNDLE_KB" -ne 0 ] && echo "  VIOLATION: Bundle ${BUNDLE_KB}KB > ${MAX_BUNDLE}KB" && VIOLATIONS=$((VIOLATIONS+1))

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS perf budget violations."
  exit 1
fi
echo "PASS: Perf budget OK."
exit 0
