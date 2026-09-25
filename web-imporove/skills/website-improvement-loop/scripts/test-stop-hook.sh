#!/usr/bin/env bash
# Self-check for hooks/check-stop.sh.
#
# The hook is the thing that decides whether an autonomous loop keeps running,
# so its exit codes are the contract. This asserts all five stop conditions
# fire for their own reason, and that a fresh state does NOT stop the loop.
#
# Usage: bash scripts/test-stop-hook.sh
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$DIR/../hooks/check-stop.sh"
STATE="$DIR/../scripts/state-manager.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0

pass() { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; fails=$((fails + 1)); }

# expect <name> <expected-exit> <setup-snippet>
expect() {
  local name="$1" want="$2" setup="$3"
  local s="$TMP/$RANDOM$RANDOM"
  mkdir -p "$s/artifacts/website-loop"
  node "$STATE" init --base "$s" --max-iterations 3 >/dev/null 2>&1
  ( cd "$s" && eval "$setup" ) >/dev/null 2>&1
  local out rc
  out=$(WIL_STATE="$s/artifacts/website-loop/STATE.md" \
         WIL_STOP="$s/artifacts/website-loop/STOP" \
         bash "$CHECK" 2>&1)
  rc=$?
  if [ "$rc" -eq "$want" ]; then pass "$name (exit $rc)"; else fail "$name: exit $rc, wanted $want — $out"; fi
}

echo "no state:"
out=$(WIL_STATE="$TMP/absent.md" bash "$CHECK" 2>&1); rc=$?
[ "$rc" -eq 2 ] && pass "absent state continues (exit 2)" || fail "absent state: exit $rc, wanted 2 — $out"

echo "a fresh loop must not stop:"
s="$TMP/fresh"; mkdir -p "$s/artifacts/website-loop"
node "$STATE" init --base "$s" --max-iterations 3 >/dev/null 2>&1
out=$(WIL_STATE="$s/artifacts/website-loop/STATE.md" WIL_STOP="$s/artifacts/website-loop/STOP" bash "$CHECK" 2>&1); rc=$?
[ "$rc" -eq 2 ] && pass "fresh state continues (exit 2)" || fail "fresh state: exit $rc, wanted 2 — $out"

echo "stop conditions:"
expect "iteration cap"    0 'for i in 1 2 3; do node '"$STATE"' update --base "$PWD" --iteration-done >/dev/null; done'
expect "no findings left"  0 'sed -i "s/^open_findings: -1/open_findings: 0/" artifacts/website-loop/STATE.md'
expect "no improvement"    0 'sed -i "s/^no_improvement_streak: 0/no_improvement_streak: 5/" artifacts/website-loop/STATE.md'
expect "consecutive error" 0 'for i in 1 2 3; do node '"$STATE"' update --base "$PWD" --error >/dev/null; done'
expect "STOP sentinel"     0 'touch artifacts/website-loop/STOP'

echo "the loop keeps going while work remains:"
expect "open findings present" 2 'sed -i "s/^open_findings: -1/open_findings: 4/" artifacts/website-loop/STATE.md'

echo
[ "$fails" -eq 0 ] && echo "ALL PASS" || echo "$fails FAILURE(S)"
exit $((fails > 0))
