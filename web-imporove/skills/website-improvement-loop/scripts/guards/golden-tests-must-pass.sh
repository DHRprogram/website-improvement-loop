#!/usr/bin/env bash
# golden-tests-must-pass.sh — the commit gate for a migrated route.
#
#   golden-tests-must-pass.sh [project_root] [--base-url URL]
#
# Runs the golden suite and fails the commit on any failure. A golden test is
# the only thing standing between a migration and a silent behaviour change, so
# this gate is not advisory: exit 1 blocks the commit, exactly like
# no-secret-commit.sh.
#
# exit 0 all pass (or nothing to run) | 1 a test failed | 2 bad usage
set -uo pipefail

ROOT="${1:-.}"
shift || true
BASE_URL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --base-url=*) BASE_URL="${1#*=}"; shift ;;
    *) shift ;;
  esac
done

if [ ! -d "$ROOT" ]; then
  echo "golden-tests-must-pass: '$ROOT' is not a directory" >&2
  exit 2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
RUNNER="$HERE/../golden-test-runner.mjs"

if [ ! -f "$RUNNER" ]; then
  echo "=== guard: golden-tests-must-pass ==="
  echo "FAIL: runner not found at $RUNNER"
  exit 2
fi

echo "=== guard: golden-tests-must-pass ==="

# A production base URL here would run the suite against real users. Refuse
# before the runner does, so the message names the actual problem.
if [ -n "$BASE_URL" ] && printf '%s' "$BASE_URL" | grep -qiE 'prod|www\.[^./]+\.[a-z]{2,}/?$'; then
  echo "FAIL: refusing to run golden tests against what looks like production: $BASE_URL"
  echo "Run against a test environment. The values printed are the URL you passed."
  exit 1
fi

ARGS=(--project="$ROOT")
[ -n "$BASE_URL" ] && ARGS+=(--base-url="$BASE_URL")

node "$RUNNER" "${ARGS[@]}"
RC=$?

# Every arm ends in an explicit ';;'. A bare 'exit' as the last command in an
# arm is not portable -- some bash builds reject the following pattern as a
# syntax error -- and a guard script that will not parse is worse than no guard.
case "$RC" in
  0)
    echo "=== guard: golden-tests-must-pass: PASS ==="
    exit 0
    ;;
  1)
    echo
    echo "=== guard: golden-tests-must-pass: FAIL ==="
    echo "A golden test failed. A behaviour change that was not intended is a"
    echo "regression, not a snapshot to refresh. Fix the code, or record why the"
    echo "change is intended before re-pinning. See references/golden-tests-guide.md."
    exit 1
    ;;
  *)
    echo "=== guard: golden-tests-must-pass ==="
    echo "FAIL: the runner could not decide (exit $RC). Failing closed."
    exit 2
    ;;
esac
