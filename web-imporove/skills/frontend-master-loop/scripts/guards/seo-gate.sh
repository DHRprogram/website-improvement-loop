#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: seo-gate ==="
MISSING=0

for f in $(find src -name 'page.tsx' -o -name 'page.jsx' 2>/dev/null | head -20); do
  content=$(cat "$f" 2>/dev/null || true)
  if ! echo "$content" | grep -q "<title\|Head\|head" 2>/dev/null; then
    echo "  MISSING: $f has no <title>"
    MISSING=$((MISSING + 1))
  fi
  if ! echo "$content" | grep -qi "meta.*name=.description\|meta.*og:" 2>/dev/null; then
    echo "  MISSING: $f no meta description"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 2 ]; then
  echo "FAIL: $MISSING SEO issues."
  exit 1
fi
echo "PASS: SEO gate OK. Issues: $MISSING"
exit 0
