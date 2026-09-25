#!/usr/bin/env bash
# Self-check for measure.sh target detection + JSON emit.
# Usage: bash test-measure.sh
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
M="$DIR/measure.sh"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
fails=0

detect() {  # detect <stack> <marker>
  local want="$1"; shift
  local d="$TMP/$want"; mkdir -p "$d"
  for m in "$@"; do mkdir -p "$(dirname "$d/$m")"; : > "$d/$m"; done
  local got; got=$(bash "$M" "$d" --stack-only)
  if [ "$got" = "$want" ]; then
    printf '  ok   %-8s <- %s\n' "$want" "${*:-<empty dir>}"
  else
    printf '  FAIL %-8s got %s\n' "$want" "$got"; fails=$((fails+1))
  fi
}

echo "detection:"
detect nextjs  next.config.ts
detect vite    vite.config.js
detect node    package.json
detect django  manage.py
detect python  pyproject.toml
detect go      go.mod
detect rust    Cargo.toml
detect jvm     build.gradle.kts
detect php     composer.json
detect ruby    Gemfile
detect dotnet  Contoso.csproj
detect generic

echo "precedence (most specific first):"
detect nextjs  package.json next.config.js   # next.config must beat package.json
detect vite    package.json vite.config.ts   # vite.config must beat package.json

echo "emit:"
d="$TMP/emit"; mkdir -p "$d"; : > "$d/go.mod"; : > "$d/main.go"
out=$(bash "$M" "$d" 2>/dev/null)
if printf '%s' "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["stack"]=="go"; assert d["source_files"]==1; assert "test_pass_rate" in d' 2>/dev/null; then
  echo "  ok   valid JSON, stack=go, source_files=1, key present"
else
  echo "  FAIL emit: $out"; fails=$((fails+1))
fi

echo "honest nulls (no runner installed must NOT report a score):"
if printf '%s' "$out" | grep -q '"test_pass_rate": null'; then
  echo "  ok   test_pass_rate is null, not 100"
else
  echo "  FAIL fabricated a pass rate"; fails=$((fails+1))
fi

echo
[ "$fails" -eq 0 ] && echo "ALL PASS" || echo "$fails FAILURE(S)"
exit $((fails > 0))
