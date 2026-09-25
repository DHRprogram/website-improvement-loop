#!/usr/bin/env bash
# no-prod-touch.sh — refuse to run when anything is pointed at production.
#
# The loop's hard rule is that it never writes to production. A test run
# against a real database does exactly that, so this is a pre-flight gate, not
# a review step.
#
#   no-prod-touch.sh [project_root]
#
# Checks, in order:
#   1. env files (.env*, .envrc) for a production-looking DATABASE_URL
#   2. any tracked config for a production hostname
#   3. explicit --allow-prod override, which is refused outright
#
# exit 0 clean | 1 production detected | 2 bad usage
set -uo pipefail

ROOT="${1:-.}"
if [ ! -d "$ROOT" ]; then
  echo "no-prod-touch: '$ROOT' is not a directory" >&2
  exit 2
fi

if [ "${WIL_ALLOW_PROD:-0}" = "1" ]; then
  echo "no-prod-touch: WIL_ALLOW_PROD=1 does not lift this guard." >&2
  echo "no-prod-touch: this guard exists to stop production writes. Run against a test environment instead." >&2
  exit 1
fi

# Deliberately broad, deliberately false-positive-prone. A false positive costs
# one edit to a .env.example; a false negative costs the production database.
# The file name is printed on a hit. The value never is.
PATTERN='(prod(uction)?[-_.]?[a-z0-9-]*\.)?(amazonaws\.com|rds\.amazonaws\.com|azure\.com|cloudsql\.googleapis\.com|herokuapp\.com|onrender\.com|railway\.app|fly\.dev|neon\.tech|supabase\.co):[0-9]{2,5}|postgres(ql)?://[^[:space:]"'"'"']*@[^[:space:]"'"'"']*(prod|production)[^[:space:]"'"'"']*[:/]|mysql://[^[:space:]"'"'"']*@[^[:space:]"'"'"']*(prod|production)'

HITS=0
REPORTED=0

scan() {
  local file="$1"
  [ -f "$file" ] || return 0
  # Skip binaries and lockfiles; neither carries a connection string.
  case "$file" in
    *.lock|*-lock.json|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf|*.woff*|*.zip) return 0 ;;
  esac
  if grep -qiE "$PATTERN" "$file" 2>/dev/null; then
    echo "  BLOCKED  $file  (looks like a production connection target)"
    REPORTED=$((REPORTED + 1))
  fi
}

echo "=== no-prod-touch: scanning $ROOT ==="

# .env files, including the gitignored ones — the gitignored one is the
# dangerous one, because it is the developer's real local config.
while IFS= read -r f; do scan "$f"; done < <(find "$ROOT" -maxdepth 3 \( -name '.env' -o -name '.env.*' -o -name '.envrc' \) -not -path '*/node_modules/*' 2>/dev/null)

# Tracked config that names production.
while IFS= read -r f; do scan "$f"; done < <(find "$ROOT" -maxdepth 3 \( -name '*.yml' -o -name '*.yaml' -o -name '*.json' -o -name '*.toml' -o -name '*.sh' \) -not -path '*/node_modules/*' -not -name '*.example.*' -not -name '*.lock' 2>/dev/null)

# A DATABASE_URL in the environment right now.
if [ -n "${DATABASE_URL:-}" ]; then
  if printf '%s' "$DATABASE_URL" | grep -qiE "$PATTERN"; then
    echo "  BLOCKED  environment variable DATABASE_URL points at production"
    REPORTED=$((REPORTED + 1))
  fi
fi

if [ "$REPORTED" -gt 0 ]; then
  HITS=1
fi

if [ "$HITS" -eq 0 ]; then
  echo "=== no-prod-touch: clean. No production target found. ==="
  exit 0
fi

echo
echo "=== guard: no-prod-touch ==="
echo "FAIL: $REPORTED location(s) reference a production target."
echo "The loop must not write to production. Point these at a test environment,"
echo "or use a .env.example for documentation. Values are not printed on purpose."
exit 1
