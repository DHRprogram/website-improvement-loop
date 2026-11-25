#!/usr/bin/env bash
set -euo pipefail

# Metrics snapshot for Phase A / trend-chart.mjs / cron-check.sh.
# Usage: bash scripts/measure.sh [label]
# Writes ${METRICS_DIR:-metrics}/<label>.json with:
#   label, date, bundle_kb, todos, deps, files, loc, git_sha

LABEL="${1:-$(date -u +%Y%m%d_%H%M%S)}"
OUT_DIR="${METRICS_DIR:-metrics}"
mkdir -p "$OUT_DIR"

# Collect source files once (deps/build/VCS excluded).
FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(find . -type f \
  \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.ts' -o -name '*.tsx' \
     -o -name '*.jsx' -o -name '*.vue' -o -name '*.svelte' -o -name '*.css' -o -name '*.scss' \
     -o -name '*.html' \) \
  -not -path './node_modules/*' -not -path './.git/*' -not -path './dist/*' \
  -not -path './build/*' -not -path './.next/*' -not -path './coverage/*' \
  -not -path './artifacts/*' -print0 2>/dev/null)

SRC_BYTES=0
LOC=0
if [ ${#FILES[@]} -gt 0 ]; then
  SRC_BYTES=$(wc -c "${FILES[@]}" | tail -1 | awk '{ print $1 }')
  LOC=$(cat "${FILES[@]}" | wc -l | tr -d ' ')
fi
SRC_FILES=${#FILES[@]}

# Open issues: TODO/FIXME/HACK/XXX markers in source.
TODOS=0
if [ ${#FILES[@]} -gt 0 ]; then
  TODOS=$(grep -hE 'TODO|FIXME|HACK|XXX' "${FILES[@]}" 2>/dev/null \
    | grep -vE 'node_modules|/dist/|/build/|\.min\.' \
    | wc -l | tr -d ' ' || true)
  [ -n "$TODOS" ] || TODOS=0
fi

# Declared dependencies (dependencies + devDependencies).
DEPS=0
if [ -f package.json ]; then
  DEPS=$(node -e "try { const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(Object.keys(p.dependencies||{}).length + Object.keys(p.devDependencies||{}).length); } catch (e) { console.log(0); }")
fi

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
BUNDLE_KB=$((SRC_BYTES / 1024))

OUT="$OUT_DIR/${LABEL}.json"
cat > "$OUT" <<EOF
{
  "label": "$LABEL",
  "date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "bundle_kb": $BUNDLE_KB,
  "todos": $TODOS,
  "deps": $DEPS,
  "files": $SRC_FILES,
  "loc": $LOC,
  "git_sha": "$GIT_SHA"
}
EOF

echo "[OK] $OUT (bundle_kb=$BUNDLE_KB todos=$TODOS deps=$DEPS files=$SRC_FILES loc=$LOC)"
