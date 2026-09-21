#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: no-secret-commit ==="
VIOLATIONS=0
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
CHANGED=$(git diff --name-only 2>/dev/null || true)
FILES="${STAGED} ${CHANGED}"

SECRET_PATTERNS=(
  "github_pat_"
  "ghp_"
  "gho_"
  "ghu_"
  "ghs_"
  "ghr_"
  "sk-"
  "AKIA"
  "BEGIN PRIVATE KEY"
  "BEGIN RSA PRIVATE KEY"
  "BEGIN OPENSSH PRIVATE KEY"
  "BEGIN EC PRIVATE KEY"
  "password="
  "secret="
  "api_key="
)

for FILE in $FILES; do
  [ -z "$FILE" ] && continue
  case "$FILE" in *.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|package-lock.json|yarn.lock) continue ;; esac
  [ ! -f "$FILE" ] && continue
  CONTENT=$(cat "$FILE" 2>/dev/null || true)
  [ -z "$CONTENT" ] && continue
  for PATTERN in "${SECRET_PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qiE "$PATTERN" 2>/dev/null; then
      echo "  VIOLATION: $FILE matches '$PATTERN'"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS secret violations."
  exit 1
fi
echo "PASS: No secrets detected."
exit 0
