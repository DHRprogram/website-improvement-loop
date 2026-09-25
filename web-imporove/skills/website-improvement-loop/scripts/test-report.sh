#!/usr/bin/env bash
# V17 — the user-test HTML report must render from real input.
#
# It runs the shipped examples through the real aggregator rather than a stub,
# because a report generator that is only ever tested against a fixture it
# wrote itself is not tested at all.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PASS=0; FAIL=0

pass() { echo "  ok   $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL $1"; FAIL=$((FAIL+1)); }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/artifacts/USER_TEST"
cp "$ROOT"/examples/persona-*.example.json "$WORK/artifacts/USER_TEST/"

cd "$WORK" || exit 1

echo "aggregating the shipped example personas:"
if node "$ROOT/scripts/user-test/aggregate-findings.mjs" artifacts/USER_TEST; then
  pass "aggregate-findings.mjs produced AGGREGATE.json"
else
  fail "aggregate-findings.mjs failed"
fi
[ -s artifacts/USER_TEST/AGGREGATE.json ] && pass "AGGREGATE.json is non-empty" || fail "AGGREGATE.json is empty"

echo "rendering the report:"
if node "$ROOT/scripts/html-report.mjs"; then
  pass "html-report.mjs exited 0"
else
  fail "html-report.mjs exited non-zero"
fi

[ -s artifacts/REPORT.html ] && pass "REPORT.html is non-empty" || fail "REPORT.html is empty"

# The structural assertions live in Node so the regexes are not at the mercy of
# shell quoting, and so the file is parsed as text exactly as a browser would.
node - "$WORK/artifacts/REPORT.html" <<'NODE'
const fs = require('fs');
const f = process.argv[2];
let ok = true;
const html = fs.readFileSync(f, 'utf8');

const checks = [
  ['starts with a doctype', /^<!DOCTYPE html>/i.test(html)],
  ['declares a language', /<html\s+lang=/i.test(html)],
  ['declares utf-8', /charset=["']?utf-8/i.test(html)],
  ['has a viewport', /name=["']viewport["']/i.test(html)],
  ['has a non-empty title', /<title>\s*\S[^<]*<\/title>/i.test(html)],
  ['closes html', /<\/html>\s*$/i.test(html)],
  ['no unresolved template interpolation', !html.includes('${')],
  ['no unresolved undefined leaks', !/>\s*(undefined|null|NaN|\[object Object\])\s*</.test(html)],
];
for (const [name, pass] of checks) {
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!pass) ok = false;
}

// Every element we actually emit must be balanced. Void elements are excluded.
const CONTAINERS = ['html','head','body','div','section','article','table','thead',
  'tbody','tfoot','tr','td','th','ul','ol','li','h1','h2','h3','h4','p','span',
  'button','a','main','header','footer','nav','details','summary'];
for (const tag of CONTAINERS) {
  const open = (html.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  if (open !== close) {
    console.log(`  FAIL  <${tag}> unbalanced: ${open} open / ${close} close`);
    ok = false;
  }
}
console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${CONTAINERS.length} element types balanced`);
process.exit(ok ? 0 : 1);
NODE
if [ $? -eq 0 ]; then pass "REPORT.html is structurally valid"; else fail "REPORT.html is malformed"; fi

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL PASS ($PASS)"; exit 0; fi
echo "$FAIL FAILURE(S)"; exit 1
