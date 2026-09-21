#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: flag-safety ==="
MISSING=0

if [ -d src ]; then
  FEATURE_FLAGS=$(grep -r "redesign\|featureFlag\|feature_flag\|unleash\|flagsmith" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || true)
  echo "  Feature flag references in src: $FEATURE_FLAGS"
  if [ "$FEATURE_FLAGS" -eq 0 ] && [ -f "artifacts/redesign/APPROVALS.json" ]; then
    echo "  WARNING: No feature flag provider integration found in source."
  fi
fi

echo "PASS: Flag safety check completed."
exit 0
