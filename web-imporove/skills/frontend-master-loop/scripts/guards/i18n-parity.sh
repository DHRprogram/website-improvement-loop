#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: i18n-parity ==="
declare -a LOCALE_FILES=()
MISSING=0

for f in $(find . -name "messages.*.json" -o -name "i18n.*.json" -o -name "*.i18n.*" 2>/dev/null | head -10); do
  LOCALE_FILES+=("$f")
done

if [ ${#LOCALE_FILES[@]} -le 1 ]; then
  echo "  INFO: Single locale or no i18n files found. OK."
  exit 0
fi

BASE_FILE="${LOCALE_FILES[0]}"
for locale_file in "${LOCALE_FILES[@]:1}"; do
  BASE_KEYS=$(node -e "console.log(Object.keys(require('$BASE_FILE')).sort().join(','))" 2>/dev/null || echo "")
  LOCALE_KEYS=$(node -e "console.log(Object.keys(require('$locale_file')).sort().join(','))" 2>/dev/null || echo "")
  if [ "$BASE_KEYS" != "$LOCALE_KEYS" ]; then
    echo "  VIOLATION: Keys differ between $BASE_FILE and $locale_file"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo "FAIL: $MISSING i18n parity issues."
  exit 1
fi
echo "PASS: i18n parity OK."
exit 0
