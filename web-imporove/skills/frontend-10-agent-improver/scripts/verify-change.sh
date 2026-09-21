#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${1:-.}"
METRIC_NAME="${2:-}"
DIRECTION="${3:-better}"  # "better" or "worse" direction for the metric

cd "$BASE"

echo "=== Verify Change ==="

# Step 1: Build
echo "[1/5] Build check"
if [ -f package.json ]; then
  if grep -q '"build"' package.json 2>/dev/null; then
    if ! npm run build 2>&1; then
      echo "FAIL: Build failed"
      exit 1
    fi
  else
    echo "SKIP: No build script in package.json"
  fi
fi

# Step 2: Lint
echo "[2/5] Lint check"
if grep -q '"lint"' package.json 2>/dev/null; then
  if ! npm run lint 2>&1; then
    echo "FAIL: Lint failed"
    exit 1
  fi
else
  echo "SKIP: No lint script in package.json"
fi

# Step 3: TypeScript type check
echo "[3/5] Type check"
if [ -f tsconfig.json ]; then
  if grep -q '"typecheck\|"typescript' package.json 2>/dev/null; then
    if ! npx tsc --noEmit 2>&1; then
      echo "FAIL: TypeScript errors found"
      exit 1
    fi
  else
    echo "SKIP: No typecheck script in package.json"
  fi
fi

# Step 4: Test
echo "[4/5] Test check"
if grep -q '"test"' package.json 2>/dev/null; then
  if ! npm test 2>&1; then
    echo "FAIL: Tests failed"
    exit 1
  fi
else
  echo "SKIP: No test script in package.json"
fi

# Step 5: Measure metric delta
echo "[5/5] Metric check"
if [ -n "$METRIC_NAME" ]; then
  MEASURE_OUTPUT=$("$SCRIPT_DIR/measure-frontend.sh")
  CURRENT_VALUE=$(echo "$MEASURE_OUTPUT" | grep -o "\"$METRIC_NAME\": [0-9.]*" | awk '{print $2}' || echo "")

  if [ -n "$CURRENT_VALUE" ]; then
    # Read baseline from artifacts
    BASELINE_FILE="$BASE/artifacts/frontend-loop/BASELINE.json"
    if [ -f "$BASELINE_FILE" ]; then
      BASELINE=$(grep -o "\"$METRIC_NAME\": [0-9.]*" "$BASELINE_FILE" | awk '{print $2}' || echo "")
      if [ -n "$BASELINE" ]; then
        DELTA=$(echo "$CURRENT_VALUE - $BASELINE" | bc -l 2>/dev/null || echo "0")
        echo "  Metric $METRIC_NAME: $BASELINE -> $CURRENT_VALUE (delta: $DELTA)"

        if [ "$DIRECTION" = "better" ] && [ "$(echo "$DELTA < 0" | bc -l 2>/dev/null)" = "1" ]; then
          echo "FAIL: Metric $METRIC_NAME regressed ($BASELINE -> $CURRENT_VALUE)"
          exit 2
        fi
      fi
    fi
  fi
fi

echo "=== Verify Change PASS ==="
exit 0
