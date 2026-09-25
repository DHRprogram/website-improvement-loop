#!/usr/bin/env bash
# Refuse a commit that contains a credential.
# Reads the STAGED set, because this guards a commit. Stage first, then run.
#   exit 0 -> clean
#   exit 1 -> a pattern matched; the FILE is named, never the value
set -uo pipefail

echo "=== guard: no-secret-commit ==="

STAGED="$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || true)"
if [ -z "$STAGED" ]; then
  echo "  no staged files — nothing to check"
  echo "PASS"
  exit 0
fi

# Matched against file CONTENT. The matched value is never printed.
PATTERNS='github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghu_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|ghr_[A-Za-z0-9]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|password[[:space:]]*=|secret[[:space:]]*=|api_key[[:space:]]*=|apikey[[:space:]]*=|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}'

VIOLATIONS=0
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  [ -f "$FILE" ] || continue
  case "$FILE" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.webp|*.svg|*.woff|*.woff2|*.ttf|*.eot) continue ;;
    *.lock|package-lock.json|yarn.lock|pnpm-lock.yaml) continue ;;
    *.md) continue ;;
  esac
  # Fixtures and tests legitimately contain fake credentials.
  case "$FILE" in
    *test*|*spec*|*mock*|*fixture*|*__tests__*|*.example.*|*.sample.*) continue ;;
  esac
  if grep -qEI "$PATTERNS" "$FILE" 2>/dev/null; then
    printf '  VIOLATION: %s matches a credential pattern (value not shown)\n' "$FILE"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done <<< "$STAGED"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS file(s) look like they contain a credential. Unstage them."
  exit 1
fi

echo "PASS: no credential patterns in staged files."
exit 0
