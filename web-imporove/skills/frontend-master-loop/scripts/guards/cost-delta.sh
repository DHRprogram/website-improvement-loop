#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: cost-delta ==="
MAX_DELTA="${MAX_COST_DELTA_PCT:-20}"

if [ -f "artifacts/redesign/cost-delta/COST_DELTA.json" ]; then
  ACTUAL_DELTA=$(jq -r '.max_delta_pct // 0' artifacts/redesign/cost-delta/COST_DELTA.json 2>/dev/null || echo "0")
  if [ "$(echo "$ACTUAL_DELTA > $MAX_DELTA" | bc -l 2>/dev/null)" = "1" ]; then
    echo "FAIL: Cost delta ${ACTUAL_DELTA}% > ${MAX_DELTA}% limit. HST-05."
    exit 1
  fi
  echo "PASS: Cost delta ${ACTUAL_DELTA}% within ${MAX_DELTA}% limit."
else
  echo "  INFO: No cost delta report. Run R8.7 first."
fi
exit 0
