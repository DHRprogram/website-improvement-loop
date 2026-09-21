#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: a11y-gate ==="
VIOLATIONS=0
for f in $(find src -name '*.tsx' -o -name '*.jsx' 2>/dev/null | head -20); do
  if grep -q "alt=\"\"" "$f" 2>/dev/null; then
    echo "  VIOLATION: Empty alt text in $f"
  fi
  if grep -q "onClick" "$f" 2>/dev/null && ! grep -q "role=\"button\"" "$f" 2>/dev/null && ! grep -q "<button" "$f" 2>/dev/null; then
    if grep -q "onClick" "$f" 2>/dev/null && grep -q "<div\|<span" "$f" 2>/dev/null; then
      echo "  VIOLATION: Non-interactive element with onClick in $f"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
done

if [ "$VIOLATIONS" -gt 3 ]; then
  echo "FAIL: $VIOLATIONS a11y violations found. HST-10 if critical."
  exit 1
fi
echo "PASS: a11y gate OK. Minor issues: $VIOLATIONS"
exit 0
