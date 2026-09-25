#!/usr/bin/env bash
# verify-frontend.sh — frontend-only verification.
#
#   verify-frontend.sh [project_root]
#
# Runs lint, type-check and build, and the frontend test suite, but never the
# backend suite and never anything that touches a database. This is what makes
# /web-improvement-loop:frontend safe to run unattended: the checks here cannot
# have side effects outside the repository.
#
# Exit codes follow verify-change.sh so the orchestrator can branch on them:
#   0 pass | 1 build/lint/type/test failure | 2 bad usage
set -uo pipefail

ROOT="${1:-.}"
if [ ! -d "$ROOT" ]; then
  echo "verify-frontend: '$ROOT' is not a directory" >&2
  exit 2
fi

cd "$ROOT" || exit 2

FAILED=0
run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then
    echo "  ok   $label"
  else
    echo "  FAIL $label (exit $?)"
    FAILED=1
  fi
}

echo "=== verify-frontend: $ROOT ==="

# A frontend check that runs the backend suite is not a frontend check.
if [ -f package.json ]; then
  if node -e "
    const p=require('./package.json'); const s=p.scripts||{};
    const t=[s.test,s['test:unit'],s['test:frontend']].filter(Boolean).join(' ');
    process.exit(/jest|vitest|playwright|cypress|mocha|karma/.test(t)?0:1);
  " 2>/dev/null; then
    echo "  note: the package test script looks like a frontend runner."
  else
    echo "  note: no recognisable frontend test script; skipping the test step."
    echo "        (a backend suite may exist but is out of scope for this check)"
  fi
fi

if [ -f package.json ] && node -e "const p=require('./package.json');process.exit(p.scripts&&(p.scripts.lint||p.scripts['lint:js']||p.scripts['lint:ts'])?0:1)" 2>/dev/null; then
  if node -e "const p=require('./package.json');process.stdout.write(p.scripts.lint||p.scripts['lint:js']||p.scripts['lint:ts']||'')"; then :; fi
  run "lint" npm run --silent lint
else
  echo "  skip lint (no lint script)"
fi

if [ -f tsconfig.json ]; then
  run "typecheck" npx --no-install tsc --noEmit
else
  echo "  skip typecheck (no tsconfig.json)"
fi

if [ -f package.json ] && node -e "const p=require('./package.json');process.exit(p.scripts&&(p.scripts.build||p.scripts['build:web'])?0:1)" 2>/dev/null; then
  run "build" npm run --silent build
else
  echo "  skip build (no build script)"
fi

if [ -f package.json ] && node -e "
  const p=require('./package.json'); const s=p.scripts||{};
  const t=s['test:frontend']||s['test:unit']||s.test||'';
  process.exit(/jest|vitest|playwright|cypress|mocha|karma/.test(t)?0:1);
" 2>/dev/null; then
  SCRIPT=$(node -e "
    const p=require('./package.json'); const s=p.scripts||{};
    process.stdout.write(s['test:frontend']||s['test:unit']||s.test||'');
  ")
  if [ "${FRONTEND_SKIP_DB:-0}" != "1" ] && printf '%s' "$SCRIPT" | grep -qiE 'prisma|migrate|seed|integration|e2e:api'; then
    echo "  skip tests (the test script references database or API integration;"
    echo "        set FRONTEND_SKIP_DB=1 to override deliberately)"
  else
    run "tests" npm run --silent "${SCRIPT%% *}"
  fi
else
  echo "  skip tests (no frontend test script)"
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "=== verify-frontend: PASS ==="
  exit 0
fi
echo "=== verify-frontend: FAIL ==="
exit 1
