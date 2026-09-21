#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: No Secret Commit ==="

# Check staged files (what would be committed)
CHANGED_FILES=$(git diff --cached --name-only 2>/dev/null || true)
CHANGED_FILES="$CHANGED_FILES
$(git diff --name-only 2>/dev/null || true)"

VIOLATIONS=0
declare -a SECRET_PATTERNS=(
  "github_pat_"
  "ghp_"
  "gho_"
  "ghu_"
  "ghs_"
  "ghr_"
  "sk-"
  "sk-ant-"
  "AKIA[0-9A-Z]{16}"
  "BEGIN PRIVATE KEY"
  "BEGIN RSA PRIVATE KEY"
  "BEGIN OPENSSH PRIVATE KEY"
  "BEGIN EC PRIVATE KEY"
  "BEGIN DSA PRIVATE KEY"
  "BEGIN PGP PRIVATE KEY"
  "password="
  "secret="
  "api_key="
  "apikey="
  "token="
  "apiKey="
  "API_KEY="
  "SECRET_KEY="
  "client_secret"
  "app_secret"
  "db_password"
  "mysql://"
  "postgres://"
  "mongodb://"
  "redis://"
  "xox[baprs]-"  # Slack tokens
  "ya29\."       # Google OAuth
  "AIza"         # Google API
  "-----BEGIN"
)

check_file_for_secrets() {
  local FILE="$1"
  if [ ! -f "$FILE" ]; then return 0; fi

  local CONTENT=""
  CONTENT=$(cat "$FILE" 2>/dev/null || true)
  [ -z "$CONTENT" ] && return 0

  for PATTERN in "${SECRET_PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qE "$PATTERN"; then
      # Allow test files with mock tokens
      if echo "$FILE" | grep -qE "(test|spec|mock|fixture|__tests__|\.test\.)"; then
        continue
      fi
      echo "  VIOLATION: $FILE matches pattern '$PATTERN'"
      VIOLATIONS=$((VIOLATIONS + 1))
      return 1
    fi
  done
  return 0
}

for FILE in $CHANGED_FILES; do
  [ -z "$FILE" ] && continue
  # Skip binary, lock, and vendor files
  case "$FILE" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff|*.woff2|*.ttf|*.eot|*.lock|package-lock.json|yarn.lock|pnpm-lock.yaml) continue ;;
  esac
  check_file_for_secrets "$FILE"
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS secret violations detected."
  exit 1
fi

echo "PASS: No secrets detected in changed files."
exit 0
