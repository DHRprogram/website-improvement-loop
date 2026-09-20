#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL is required — set to staging or production URL}"
AXE_ROUTES="${AXE_ROUTES:-/}"
FRICTION_DELTA="${FRICTION_DELTA:-0.15}"
NEW_P0_MAX="${NEW_P0_MAX:-0}"
NEW_P1_MAX="${NEW_P1_MAX:-0}"
A11Y_CRITICAL_MAX="${A11Y_CRITICAL_MAX:-0}"
A11Y_SERIOUS_MAX="${A11Y_SERIOUS_MAX:-2}"

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Installing Playwright browsers"
npx playwright install --with-deps chromium 2>/dev/null || true

echo "==> Running axe-core accessibility audit"
node scripts/user-test/run-axe.mjs "$BASE_URL" $(echo "$AXE_ROUTES" | tr ',' ' ')

echo "==> Aggregating findings"
node scripts/user-test/aggregate-findings.mjs

echo "==> Checking regression against baseline"
FRICTION_DELTA="$FRICTION_DELTA" NEW_P0_MAX="$NEW_P0_MAX" NEW_P1_MAX="$NEW_P1_MAX" \
A11Y_CRITICAL_MAX="$A11Y_CRITICAL_MAX" A11Y_SERIOUS_MAX="$A11Y_SERIOUS_MAX" \
node scripts/user-test/baseline-check.mjs

echo "==> gate passed"
