#!/usr/bin/env bash
# Block any change to backend, data or schema surfaces.
# Reads the STAGED set, because this guards a commit. Stage first, then run.
#   exit 0 -> nothing backend-ish is staged
#   exit 1 -> a violation is staged
set -uo pipefail

echo "=== guard: no-backend-touch ==="

STAGED="$(git diff --cached --name-only 2>/dev/null || true)"
if [ -z "$STAGED" ]; then
  echo "  no staged files — nothing to check"
  echo "PASS"
  exit 0
fi

BLOCKED_PATH='(^|/)(server|api|backend|db|database|migrations?|prisma|models?|schema|seeds?)/'
BLOCKED_FILE='\.sql$|(^|/)(schema|migrate|migration|seed)\.[^/]+$|\.prisma$'

VIOLATIONS=0
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  case "$FILE" in
    *node_modules*|*.lock|package-lock.json) continue ;;
  esac
  if printf '%s' "$FILE" | grep -qE "$BLOCKED_PATH"; then
    printf '  VIOLATION: %s (backend path)\n' "$FILE"
    VIOLATIONS=$((VIOLATIONS + 1))
  elif printf '%s' "$FILE" | grep -qE "$BLOCKED_FILE"; then
    printf '  VIOLATION: %s (schema or migration file)\n' "$FILE"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done <<< "$STAGED"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS backend violation(s). This loop is frontend-scoped."
  exit 1
fi

echo "PASS: no backend, data or schema files staged."
exit 0
