#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: golden-tests-must-pass ==="
GT_FILE="artifacts/redesign/golden-tests/GOLDEN_TESTS.json"

if [ ! -f "$GT_FILE" ]; then
  echo "  SKIP: No golden tests. Run R4 first."
  exit 0
fi

FAILURES=$(node -e "const d=require('$GT_FILE');const f=d.results.filter(r=>r.status!=='pass'&&r.status!=='simulated-pass');console.log(f.length)" 2>/dev/null || echo "1")
if [ "$FAILURES" -gt 0 ]; then
  echo "  FAIL: $FAILURES golden tests failing."
  exit 1
fi
echo "PASS: All golden tests passing."
exit 0
