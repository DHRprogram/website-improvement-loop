#!/usr/bin/env bash
# Self-check for scripts/guards/*.sh.
#
# Each guard is a commit-time veto, so each one is exercised in a throwaway git
# repo with a real staged change — including the case where it must PASS.
#
# Usage: bash scripts/test-guards.sh
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARDS="$DIR/guards"
fails=0

pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails + 1)); }

new_repo() {           # new_repo -> prints a scratch repo path on stdout
  local d
  d=$(mktemp -d)
  git -C "$d" init -q -b main
  git -C "$d" config user.email t@example.com
  git -C "$d" config user.name Test
  printf 'placeholder\n' > "$d/README.md"
  git -C "$d" add -A
  git -C "$d" commit -qm init
  echo "$d"
}

# check <name> <guard> <expected-exit> <file-to-create> [content]
check() {
  local name="$1" guard="$2" want="$3" file="$4" content="${5:-x}"
  local repo
  repo=$(new_repo)
  mkdir -p "$(dirname "$repo/$file")"
  printf '%s\n' "$content" > "$repo/$file"
  git -C "$repo" add -A
  local out rc
  out=$(cd "$repo" && bash "$GUARDS/$guard" 2>&1); rc=$?
  if [ "$rc" -eq "$want" ]; then pass "$name (exit $rc)"; else fail "$name: exit $rc, wanted $want — $(echo "$out" | tail -2)"; fi
}

echo "no-main-commit.sh:"
check "blocks main"   no-main-commit.sh 1 "src/app.js"
repo=$(new_repo)
git -C "$repo" checkout -q -b loop/test
out=$(cd "$repo" && bash "$GUARDS/no-main-commit.sh" 2>&1); rc=$?
[ "$rc" -eq 0 ] && pass "allows a loop branch (exit 0)" || fail "loop branch: exit $rc, wanted 0"

echo "no-secret-commit.sh:"
# The probe strings are assembled at runtime instead of written literally. A
# hardcoded "ghp_<36 chars>" sitting in the repo is indistinguishable from a
# real leaked token to every scanner, this one included -- and the guard only
# needs the shape, not the bytes.
TOKEN="gh""p_$(printf 'A%.0s' $(seq 1 26))012345"
PEM="-----BEGIN RSA ""PRIVATE KEY-----"
check "blocks a token"        no-secret-commit.sh 1 "src/config.js" "const k = \"$TOKEN\";"
check "blocks a private key"  no-secret-commit.sh 1 "deploy.pem"   "$PEM"
check "allows a fake in a fixture" no-secret-commit.sh 0 "tests/fixtures/auth.json" "{\"token\":\"$TOKEN\"}"
check "allows ordinary code"  no-secret-commit.sh 0 "src/app.js"    'export const add = (a, b) => a + b;'

echo "no-backend-touch.sh:"
check "blocks a route"   no-backend-touch.sh 1 "src/api/users.js"
check "blocks a schema"  no-backend-touch.sh 1 "prisma/schema.prisma"
check "blocks a sql file"    no-backend-touch.sh 1 "db/001_init.sql"
check "allows a component"   no-backend-touch.sh 0 "src/components/Button.tsx"  'export const B = () => null;'
check "allows a hook"        no-backend-touch.sh 0 "src/hooks/useCart.ts"       'export const useCart = () => null;'
check "allows a test fixture" no-backend-touch.sh 0 "tests/fixtures/user.json"  '{"id":1}'

echo "metric-must-improve.sh:"
repo=$(new_repo)
run_metric() { (cd "$repo" && bash "$GUARDS/metric-must-improve.sh" "$@"); }
out=$(run_metric bundle_kb 400 380 lower);  rc=$?; [ $rc -eq 0 ] && pass "lower metric improved"        || fail "lower improved: exit $rc"
out=$(run_metric bundle_kb 400 430 lower);  rc=$?; [ $rc -eq 1 ] && pass "lower metric regressed"        || fail "lower regressed: exit $rc, wanted 1"
out=$(run_metric bundle_kb 400 400 lower);  rc=$?; [ $rc -eq 0 ] && pass "lower metric unchanged"       || fail "lower unchanged: exit $rc"
out=$(run_metric test_pass_rate 90 95 higher); rc=$?; [ $rc -eq 0 ] && pass "higher metric improved"       || fail "higher improved: exit $rc"
out=$(run_metric test_pass_rate 90 80 higher); rc=$?; [ $rc -eq 1 ] && pass "higher metric regressed"      || fail "higher regressed: exit $rc, wanted 1"
out=$(run_metric bundle_kb 400 430 higher); rc=$?; [ $rc -eq 0 ] && pass "direction is inferred"        || fail "inferred direction: exit $rc"
out=$(run_metric bundle_kb 400 430 sideways); rc=$?; [ $rc -eq 2 ] && pass "bad direction rejected"       || fail "bad direction: exit $rc, wanted 2"

echo "an unmeasured metric is skipped, not assumed:"
printf '{"bundle_kb": null}\n' > "$repo/before.json"
printf '{"bundle_kb": 999}\n' > "$repo/after.json"
out=$(cd "$repo" && bash "$GUARDS/metric-must-improve.sh" bundle_kb before.json after.json lower); rc=$?
[ "$rc" -eq 0 ] && pass "null before is skipped" || fail "null before: exit $rc, wanted 0"
printf '{"bundle_kb": 400}\n' > "$repo/after2.json"
out=$(cd "$repo" && bash "$GUARDS/metric-must-improve.sh" bundle_kb before.json after2.json lower); rc=$?
[ "$rc" -eq 0 ] && pass "null in either file is skipped" || fail "null either: exit $rc, wanted 0"

echo
[ "$fails" -eq 0 ] && echo "ALL PASS" || echo "$fails FAILURE(S)"
exit $((fails > 0))
