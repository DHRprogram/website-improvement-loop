#!/usr/bin/env bash
# Stack-aware metrics for the A-E pipeline.
#
# This file is the SINGLE source of truth for target detection. Engine routing
# elsewhere reads the `stack` key instead of re-implementing marker checks.
#
# Every key is always present. A metric whose tool is absent is emitted as
# null, never 0 and never omitted: regression.md reads lower as better, so a
# fabricated zero would silently pass every guard, and an omitted key makes a
# consumer guess whether the tool was absent or the key was forgotten.
#
# Usage: measure.sh [repo-root] [--stack-only]
#        measure.sh <label> [repo-root]
#
#   --stack-only  print just the stack id (fast; used for engine routing)
#   <label>       write the snapshot to metrics/<label>.json and print the path
#
# A bare token that is not an existing directory is a LABEL, never a path.
# Snapshot fields beyond the core five (bundle_kb, build_time_ms,
# component_count, lighthouse_scores) are reported as null unless the evidence
# to compute them is actually present. A fabricated zero would let every
# regression guard pass silently, so an unmeasured value stays null.
set -uo pipefail

BASE="."
LABEL=""
STACK_ONLY=0
for a in "$@"; do
  case "$a" in
    --stack-only) STACK_ONLY=1 ;;
    -*)           echo "measure.sh: unknown option '$a'" >&2; exit 2 ;;
    *)
      # A token that is not an existing directory is a label, not a path.
      if [ -z "$LABEL" ] && [ ! -d "$a" ] && printf '%s' "$a" | grep -qE '^[A-Za-z0-9][A-Za-z0-9._-]*$'; then
        LABEL="$a"
      else
        BASE="$a"
      fi ;;
  esac
done
cd "$BASE" || exit 1
TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

exists() { [ -e "$1" ] || compgen -G "$1" >/dev/null 2>&1; }
any()    { local f; for f in "$@"; do exists "$f" && return 0; done; return 1; }

stack=generic
if   any 'next.config.*' 'nuxt.config.*';                 then stack=nextjs
elif any 'vite.config.*';                                then stack=vite
elif exists package.json;                                then stack=node
elif exists manage.py;                                   then stack=django
elif any pyproject.toml requirements.txt setup.py Pipfile; then stack=python
elif exists go.mod;                                      then stack=go
elif exists Cargo.toml;                                  then stack=rust
elif any pom.xml build.gradle build.gradle.kts;          then stack=jvm
elif exists composer.json;                               then stack=php
elif exists Gemfile;                                     then stack=ruby
elif any '*.csproj' '*.sln';                             then stack=dotnet
fi

if [ "$STACK_ONLY" = 1 ]; then echo "$stack"; exit 0; fi

has()  { command -v "$1" >/dev/null 2>&1; }
count() { find . -type f -name "$2" ${1:+-not -path "$1"} 2>/dev/null | wc -l | tr -d ' '; }

TEST_CMD=""; LINT_CMD=""; TYPE_CMD=""; SRC_GLOB="*"; SRC_SKIP=""
case $stack in
  nextjs|vite|node)
    TEST_CMD="npm test --silent"
    grep -q '"lint"'  package.json 2>/dev/null && LINT_CMD="npm run lint --silent"
    [ -f tsconfig.json ] && has npx && TYPE_CMD="npx tsc --noEmit"
    SRC_GLOB='*.ts *.tsx *.js *.jsx'; SRC_SKIP='./node_modules/*' ;;
  django)
    TEST_CMD="python -m pytest -q"; has ruff && LINT_CMD="ruff check ."
    SRC_GLOB='*.py'; SRC_SKIP='*/.venv/*' ;;
  python)
    TEST_CMD="python -m pytest -q"; has ruff && LINT_CMD="ruff check ."
    has mypy && TYPE_CMD="mypy ."
    SRC_GLOB='*.py'; SRC_SKIP='*/.venv/*' ;;
  go)
    TEST_CMD="go test ./..."; has golangci-lint && LINT_CMD="golangci-lint run"
    SRC_GLOB='*.go' ;;
  rust)
    TEST_CMD="cargo test"; has cargo && LINT_CMD="cargo clippy"
    SRC_GLOB='*.rs'; SRC_SKIP='./target/*' ;;
  jvm)
    if [ -x ./mvnw ]; then TEST_CMD="./mvnw -q test"
    elif [ -f pom.xml ]; then TEST_CMD="mvn -q test"; fi
    SRC_GLOB='*.java *.kt'; SRC_SKIP='*/build/*' ;;
  php)
    [ -x vendor/bin/phpunit ] && TEST_CMD="vendor/bin/phpunit"
    SRC_GLOB='*.php'; SRC_SKIP='./vendor/*' ;;
  ruby)
    [ -f Gemfile ] && TEST_CMD="bundle exec rspec"
    SRC_GLOB='*.rb'; SRC_SKIP='./vendor/*' ;;
  dotnet)
    TEST_CMD="dotnet test"
    SRC_GLOB='*.cs'; SRC_SKIP='*/obj/*' ;;
esac

SRC_COUNT=0
set -f  # the globs are find patterns, not shell patterns
for g in $SRC_GLOB; do SRC_COUNT=$((SRC_COUNT + $(count "$SRC_SKIP" "$g"))); done
set +f

# ---- test pass rate --------------------------------------------------------
# One generic pattern set covers jest/vitest, pytest, cargo, mvn/gradle,
# phpunit, rspec and dotnet. Unparseable output omits the key, never guesses.
PASS_OMIT=1; TOTAL=0; FAILED=0
if [ -n "$TEST_CMD" ] && has "${TEST_CMD%% *}"; then
  OUT=$(eval "$TEST_CMD" 2>&1 || true)
  T=$(printf '%s' "$OUT" | grep -oiE '(tests:? *[0-9]+ total|tests run: *[0-9]+|[0-9]+ (passed|tests|examples))' | grep -oE '[0-9]+' | tail -1)
  F=$(printf '%s' "$OUT" | grep -oiE '([0-9]+ failed|failed:? *[0-9]+|failures:? *[0-9]+|errors:? *[0-9]+)' | grep -oE '[0-9]+' | tail -1)
  if [ -n "$T" ] && [ "$T" -gt 0 ] 2>/dev/null; then
    TOTAL=$T; FAILED=${F:-0}; PASS_OMIT=0
  fi
fi

# ---- lint / type error counts ---------------------------------------------
lint_err() { [ -n "$1" ] || return 0; has "${1%% *}" || return 0
             eval "$1" 2>&1 | grep -cE '(^|[^a-z])(error|ERROR)' ; }
LINT_RAW=$(lint_err "$LINT_CMD"); LINT_RAW=${LINT_RAW:-0}
TYPE_RAW=$(lint_err "$TYPE_CMD"); TYPE_RAW=${TYPE_RAW:-0}
[ -n "$LINT_CMD" ] || LINT_RAW="omit"
[ -n "$TYPE_CMD" ] || TYPE_RAW="omit"

# "omit" is this file's sentinel for "the tool is not installed". It becomes an
# explicit JSON null so the key is always readable without being a lie.
emit_num() { if [ "$2" = omit ]; then printf '  "%s": null,\n' "$1"; else printf '  "%s": %s,\n' "$1" "$2"; fi; }

# ---- bundle size ----------------------------------------------------------
# Only counted from a real build output directory. Source size is not bundle
# size, and reporting one as the other would make the perf metric a fiction.
BUNDLE="null"
for OUT in dist build .next out; do
  if [ -d "$OUT" ]; then
    BYTES=$(find "$OUT" -type f ! -name '*.map' ! -name '*.gz' ! -name '*.br' \
              -printf '%s\n' 2>/dev/null | awk '{t+=$1} END {printf "%d", t}')
    [ -n "$BYTES" ] && BUNDLE=$(( BYTES / 1024 ))
    break
  fi
done

# ---- build time -----------------------------------------------------------
# Timing a build on every snapshot would double the cost of the loop, so this
# is opt-in via WIL_MEASURE_BUILD=1 and null otherwise.
BUILD_MS="null"
if [ "${WIL_MEASURE_BUILD:-0}" = "1" ]; then
  case $stack in
    nextjs|vite|node) grep -q '"build"' package.json 2>/dev/null && {
                           T0=$(date +%s%N); npm run build --silent >/dev/null 2>&1
                           T1=$(date +%s%N); BUILD_MS=$(( (T1 - T0) / 1000000 )); } ;;
    go)        T0=$(date +%s%N); go build ./... >/dev/null 2>&1
               T1=$(date +%s%N); BUILD_MS=$(( (T1 - T0) / 1000000 )) ;;
    rust)      T0=$(date +%s%N); cargo build --quiet >/dev/null 2>&1
               T1=$(date +%s%N); BUILD_MS=$(( (T1 - T0) / 1000000 )) ;;
  esac
fi

# ---- component count ------------------------------------------------------
COMPONENTS=$(find . -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' -o -name '*.svelte' \) \
               -not -path './node_modules/*' -not -path '*/dist/*' -not -path '*/.next/*' \
               2>/dev/null | wc -l | tr -d ' ')

# ---- lighthouse -----------------------------------------------------------
# Read from an existing lighthouse report. Running lighthouse here would add
# tens of seconds to every snapshot for a number Phase B owns anyway.
LH="null"
LH_FILE=$(find ./.lighthouseci -name '*.json' -type f 2>/dev/null | head -n1)
if [ -n "$LH_FILE" ] && has node; then
  LH=$(node -e '
    const fs = require("fs");
    try {
      const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const c = (d.categories) || {};
      const out = {};
      for (const k of ["performance","accessibility","best-practices","seo"]) {
        if (c[k] && typeof c[k].score === "number") out[k] = Math.round(c[k].score * 100);
      }
      process.stdout.write(Object.keys(out).length ? JSON.stringify(out) : "null");
    } catch { process.stdout.write("null"); }
  ' "$LH_FILE" 2>/dev/null || echo "null")
fi

{
  printf '{\n'
  printf '  "stack": "%s",\n' "$stack"
  printf '  "source_files": %s,\n' "$SRC_COUNT"
  printf '  "test_pass_rate": %s,\n' \
    "$( [ "$PASS_OMIT" = 1 ] && echo null || echo "$(( 100 * (TOTAL - FAILED) * 10 / TOTAL ))" )"
  emit_num lint_errors   "$LINT_RAW"
  emit_num type_errors   "$TYPE_RAW"
  printf '  "bundle_kb": %s,\n' "$BUNDLE"
  printf '  "build_time_ms": %s,\n' "$BUILD_MS"
  printf '  "component_count": %s,\n' "$COMPONENTS"
  printf '  "lighthouse_scores": %s,\n' "$LH"
  printf '  "timestamp": "%s"\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '}\n'
} > "$TMP_OUT"

if [ -n "$LABEL" ]; then
  mkdir -p metrics
  cp "$TMP_OUT" "metrics/$LABEL.json"
  printf 'metrics/%s.json\n' "$LABEL"
else
  cat "$TMP_OUT"
fi
