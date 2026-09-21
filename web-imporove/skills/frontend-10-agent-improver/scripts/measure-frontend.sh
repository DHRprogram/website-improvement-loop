#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-.}"
cd "$BASE"

BUNDLE_KB=0
BUILD_TIME_MS=0
TEST_PASS_RATE=100
TYPE_ERRORS=0
LINT_ERRORS=0
COMPONENT_COUNT=0

# Bundle size
if [ -f package.json ]; then
  if grep -q '"build"' package.json 2>/dev/null; then
    BUILD_OUTPUT=$(npm run build 2>&1 || true)
    BUILD_TIME_MS=$(echo "$BUILD_OUTPUT" | grep -oP '[\d.]+(?= ms|ms|msec)' | tail -1 || echo "0")
    BUILD_TIME_MS=${BUILD_TIME_MS:-0}
  fi

  # Estimate bundle size from dist/
  if [ -d dist ]; then
    BUNDLE_KB=$(du -sk dist/ 2>/dev/null | awk '{print $1}' || echo "0")
  elif [ -d .next ]; then
    BUNDLE_KB=$(du -sk .next/static/ 2>/dev/null | awk '{print $1}' || echo "0")
  elif [ -d build ]; then
    BUNDLE_KB=$(du -sk build/ 2>/dev/null | awk '{print $1}' || echo "0")
  fi
fi

# Component count
if [ -d src ]; then
  COMPONENT_COUNT=$(find src -name '*.tsx' -o -name '*.jsx' | wc -l)
elif [ -d app ]; then
  COMPONENT_COUNT=$(find app -name '*.tsx' -o -name '*.jsx' | wc -l)
elif [ -d pages ]; then
  COMPONENT_COUNT=$(find pages -name '*.tsx' -o -name '*.jsx' | wc -l)
elif [ -d components ]; then
  COMPONENT_COUNT=$(find components -name '*.tsx' -o -name '*.jsx' | wc -l)
fi

# Type errors
if [ -f tsconfig.json ] && command -v npx &>/dev/null; then
  TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
  TYPE_ERRORS=$(echo "$TSC_OUTPUT" | grep -c 'error TS[0-9]' || echo "0")
fi

# Lint errors
if [ -f package.json ] && grep -q '"lint"' package.json 2>/dev/null; then
  LINT_OUTPUT=$(npm run lint 2>&1 || true)
  LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -cE 'error|ERROR' || echo "0")
fi

# Test pass rate
if [ -f package.json ] && grep -q '"test"' package.json 2>/dev/null; then
  TEST_OUTPUT=$(npm test 2>&1 || true)
  TOTAL=$(echo "$TEST_OUTPUT" | grep -oP 'Tests:\s+\d+' | grep -oP '\d+' | tail -1 || echo "0")
  FAILED=$(echo "$TEST_OUTPUT" | grep -oP 'failed:\s+\d+' | grep -oP '\d+' | tail -1 || echo "0")
  TOTAL=${TOTAL:-0}
  FAILED=${FAILED:-0}
  if [ "$TOTAL" -gt 0 ]; then
    TEST_PASS_RATE=$(echo "scale=1; 100 * ($TOTAL - $FAILED) / $TOTAL" | bc -l 2>/dev/null || echo "100")
  fi
fi

cat << JSONEOF
{
  "bundle_kb": ${BUNDLE_KB},
  "build_time_ms": ${BUILD_TIME_MS},
  "test_pass_rate": ${TEST_PASS_RATE},
  "type_errors": ${TYPE_ERRORS},
  "lint_errors": ${LINT_ERRORS},
  "component_count": ${COMPONENT_COUNT},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSONEOF
