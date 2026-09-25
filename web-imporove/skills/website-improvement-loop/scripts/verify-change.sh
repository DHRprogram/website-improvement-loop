#!/usr/bin/env bash
# Verify one iteration did not make things worse.
#
#   verify-change.sh <metric-name> [direction] [label]
#
# direction: lower | higher | auto (default auto, resolved from the metric name)
#
# Runs build -> lint -> typecheck -> test, measures the result, and compares it
# with the previous snapshot.
#
#   exit 0 -> the build is green and the metric did not regress
#   exit 1 -> the build, lint, typecheck or tests failed
#   exit 2 -> the metric regressed, so the orchestrator must revert
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEASURE="$SCRIPT_DIR/measure.sh"
GUARD="$SCRIPT_DIR/guards/metric-must-improve.sh"

BASE="${WIL_BASE:-.}"
BASE="$(cd "$BASE" 2>/dev/null && pwd || echo '.')"

METRIC="${1:-rubric_total}"
DIRECTION="${2:-auto}"
LABEL="${3:-verify-$(date -u +%Y%m%d-%H%M%S)}"
PREV="$BASE/metrics/previous.json"
CURR="$BASE/metrics/current.json"

cd "$BASE" || { echo "cannot enter $BASE" >&2; exit 1; }

step() { printf '\n--- %s\n' "$1"; }
has()  { command -v "$1" >/dev/null 2>&1; }

# 1. Build ------------------------------------------------------------------
step "build"
BUILD_OK=1
case "$(bash "$MEASURE" . --stack-only 2>/dev/null)" in
  nextjs|vite|node)
    if [ -f package.json ] && grep -q '"build"' package.json; then
      npm run build --silent || BUILD_OK=0
    else
      echo "  no build script — skipped"
    fi ;;
  django|python)
    if [ -f manage.py ]; then python manage.py check || BUILD_OK=0
    else python -m compileall -q . >/dev/null 2>&1 || BUILD_OK=0; fi ;;
  go)     go build ./...  || BUILD_OK=0 ;;
  rust)   cargo build --quiet || BUILD_OK=0 ;;
  jvm)    if [ -x ./mvnw ]; then ./mvnw -q -DskipTests compile || BUILD_OK=0
          elif [ -f pom.xml ]; then mvn -q -DskipTests compile || BUILD_OK=0; fi ;;
  php)    has php && php -l $(find . -name '*.php' -not -path './vendor/*' 2>/dev/null | head -50) || true ;;
  ruby)   has ruby && ruby -c $(find . -name '*.rb' -not -path './vendor/*' 2>/dev/null | head -50) || true ;;
  dotnet) dotnet build --nologo -v q || BUILD_OK=0 ;;
  *)      echo "  stack '$(bash "$MEASURE" . --stack-only 2>/dev/null)' has no build step — skipped" ;;
esac
[ "$BUILD_OK" -eq 1 ] || { echo "BUILD FAILED"; exit 1; }

# 2. Lint + typecheck + test ------------------------------------------------
# measure.sh owns all three. A non-zero count is a failure, not a warning.
step "lint / typecheck / test"
bash "$MEASURE" verify > "$CURR" || { echo "MEASURE FAILED"; exit 1; }

node -e '
  const fs = require("fs");
  const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const bad = [];
  if (typeof d.lint_errors === "number" && d.lint_errors > 0) bad.push(`lint_errors=${d.lint_errors}`);
  if (typeof d.type_errors === "number" && d.type_errors > 0) bad.push(`type_errors=${d.type_errors}`);
  if (typeof d.test_pass_rate === "number" && d.test_pass_rate < 100) bad.push(`test_pass_rate=${d.test_pass_rate}`);
  if (bad.length) { console.error("  " + bad.join(", ")); process.exit(1); }
  console.log("  lint, types and tests are clean");
' "$CURR" || { echo "LINT / TYPES / TESTS FAILED"; exit 1; }

# 3. Compare ----------------------------------------------------------------
step "metric: $METRIC ($DIRECTION)"
if [ ! -f "$PREV" ]; then
  cp "$CURR" "$PREV"
  echo "  no previous snapshot — recorded $CURR as the baseline"
  exit 0
fi

bash "$GUARD" "$METRIC" "$PREV" "$CURR" "$DIRECTION"
RC=$?
if [ "$RC" -eq 1 ]; then
  echo "METRIC REGRESSED — the orchestrator must revert this iteration."
  exit 2
elif [ "$RC" -eq 2 ]; then
  echo "could not compare — treating as inconclusive, not as a pass"
  exit 1
fi

cp "$CURR" "$PREV"
echo "verified. snapshot label: $LABEL"
exit 0
