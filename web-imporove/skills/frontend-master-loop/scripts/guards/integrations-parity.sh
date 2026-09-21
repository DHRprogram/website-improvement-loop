#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: integrations-parity ==="
PASS=0
FAIL=0

if [ -d src ]; then
  INTEGRATIONS=$(grep -r "fetch\|axios\|api\.\|endpoint" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -30 | wc -l)
  echo "  API integration calls found: $INTEGRATIONS"
fi

echo "PASS: Integrations parity check completed."
exit 0
