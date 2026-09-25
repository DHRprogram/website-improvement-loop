#!/usr/bin/env bash
# Self-check for the migration half of the skill: the data contract freeze and
# diff, the guard that enforces it, route migration and rollback.
#
# These run while a redesign is in flight, so they are the pieces that must be
# exercised against a real fixture rather than trusted. test-guards.sh already
# covers the pre-migration guards; this covers the migration itself.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
pass() { echo "  ok   $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL $1"; FAIL=$((FAIL + 1)); }

WORK="$(mktemp -d)"
# The whole footprint of this script. mktemp directories are disposable, and
# nothing outside $WORK is ever touched.
cleanup() { find "$WORK" -mindepth 1 -delete 2>/dev/null; rmdir "$WORK" 2>/dev/null; }
trap cleanup EXIT

PROJ="$WORK/proj"
mkdir -p "$PROJ/src/api" "$PROJ/artifacts/website-loop"
cd "$PROJ" || exit 1
git init -q .
git config user.email t@t.t
git config user.name t

# A fixture API with a typed response, so the freezer has something real to read.
cat > src/api/orders.js <<'JS'
const db = require('./db');

app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const order = await db.find(req.params.id);
  if (!order) { res.status(404).json({ error: { code: 'not_found' } }); return; }
  res.status(200).json({ id: order.id, total: order.total, currency: order.currency, status: order.status });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  res.status(201).json({ id: 'ord_new' });
});
JS

echo "freezing the data contract:"
if node "$HERE/data-contract-freeze.mjs" --project="$PROJ" >/dev/null 2>&1; then
  pass "data-contract-freeze.mjs wrote a contract"
else
  fail "data-contract-freeze.mjs failed"
fi
[ -s artifacts/website-loop/DATA_CONTRACT.json ] && pass "contract exists and is non-empty" || fail "contract missing"

V=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/website-loop/DATA_CONTRACT.json','utf8')).contract_version)")
[ -n "$V" ] && pass "contract carries version '$V'" || fail "contract has no version"

ENDPOINTS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/website-loop/DATA_CONTRACT.json','utf8')).counts.endpoints)")
[ "$ENDPOINTS" -ge 2 ] && pass "found $ENDPOINTS endpoint(s) in the fixture" || fail "found $ENDPOINTS endpoint(s), wanted 2"

git add -A >/dev/null 2>&1
git commit -qm "freeze contract" >/dev/null 2>&1

echo
echo "no-schema-change.sh on an unchanged contract:"
bash "$HERE/guards/no-schema-change.sh" "$PROJ" >/dev/null 2>&1
[ $? -eq 0 ] && pass "unchanged contract is allowed" || fail "unchanged contract was blocked"

echo
echo "a breaking change with no approval is refused:"
cat > src/api/orders.js <<'JS'
const db = require('./db');

app.post('/api/orders', requireAuth, async (req, res) => {
  res.status(201).json({ id: 'ord_new' });
});
JS
DIFF_OUT=$(node "$HERE/data-contract-freeze.mjs" --project="$PROJ" --diff 2>&1)
DIFF_RC=$?
if [ "$DIFF_RC" -eq 1 ]; then pass "unapproved breaking change exits 1"; else fail "unapproved breaking change exited $DIFF_RC, wanted 1"; fi
printf '%s' "$DIFF_OUT" | grep -q 'BREAKING' && pass "diff labels the change BREAKING" || fail "diff did not label the change"
printf '%s' "$DIFF_OUT" | grep -q 'GET /api/orders/:id' && pass "diff names the removed endpoint" || fail "diff did not name the endpoint"

echo
echo "a malformed contract fails closed:"
echo '{ this is not json' > artifacts/website-loop/DATA_CONTRACT.json
bash "$HERE/guards/no-schema-change.sh" "$PROJ" >/dev/null 2>&1
[ $? -eq 2 ] && pass "malformed contract exits 2, not 0" || fail "malformed contract did not fail closed"

echo
echo "no contract on disk is a pass:"
# Nothing frozen means nothing to protect. The deletion case that matters is a
# contract that is committed and then removed, which the guard sees through git.
git checkout -q -- artifacts/website-loop/DATA_CONTRACT.json
rm -f artifacts/website-loop/DATA_CONTRACT.json
bash "$HERE/guards/no-schema-change.sh" "$PROJ" >/dev/null 2>&1
[ $? -eq 0 ] && pass "no contract on disk exits 0 (nothing to protect)" || fail "no contract did not exit 0"

echo
echo "a committed contract staged for deletion is refused:"
# Its own fixture repo. This case rewrites git state, and sharing a repo with
# the cases below would leave them reading a tree this one had rearranged.
DEL="$WORK/del"
mkdir -p "$DEL/artifacts/website-loop"
(
  cd "$DEL" || exit 1
  git init -q .
  git config user.email t@t.t
  git config user.name t
  cp "$PROJ/artifacts/website-loop/DATA_CONTRACT.json" artifacts/website-loop/ 2>/dev/null \
    || echo '{"contract_version":"1.0.0","frozen_at":"2026-09-25T00:00:00.000Z","endpoints":[],"models":[]}' > artifacts/website-loop/DATA_CONTRACT.json
  git add -A >/dev/null 2>&1
  git commit -qm "freeze" >/dev/null 2>&1
  # A real deletion: off disk AND staged as deleted. 'git rm --cached' would only
  # unstage it, leaving the file in place, and the guard would correctly see
  # nothing to complain about.
  git rm -q -f artifacts/website-loop/DATA_CONTRACT.json >/dev/null 2>&1
)
bash "$HERE/guards/no-schema-change.sh" "$DEL" >/dev/null 2>&1
[ $? -eq 1 ] && pass "deleting a committed contract exits 1" || fail "deleting a committed contract was allowed"

echo
echo "an approved breaking change is allowed:"
# Re-freeze first: the case above removed the contract, and a diff with nothing
# to compare against cannot demonstrate that an approval is honoured.
node "$HERE/data-contract-freeze.mjs" --project="$PROJ" >/dev/null 2>&1
cat > src/api/orders.js <<'JS'
const db = require('./db');

app.post('/api/orders', requireAuth, async (req, res) => {
  res.status(201).json({ id: 'ord_new' });
});
JS
cat > artifacts/website-loop/APPROVALS.json <<'JSON'
{ "approvals": [ { "contract_version": "1.0.0", "approver": "tech-lead", "reason": "endpoint removed in migration step 3", "date": "2026-09-25" } ] }
JSON
node "$HERE/data-contract-freeze.mjs" --project="$PROJ" --diff >/dev/null 2>&1
[ $? -eq 0 ] && pass "approved breaking change exits 0" || fail "approved breaking change was refused"
bash "$HERE/guards/no-schema-change.sh" "$PROJ" >/dev/null 2>&1
[ $? -eq 0 ] && pass "guard accepts the approved change" || fail "guard refused the approved change"

echo
echo "route migration and rollback:"
node "$HERE/migrate-route.mjs" --project="$PROJ" --route=/about --flag=about_new --step=1 --dry-run >/dev/null 2>&1
[ $? -eq 0 ] && pass "step 1 dry-run is permitted" || fail "step 1 dry-run was refused"

node "$HERE/migrate-route.mjs" --project="$PROJ" --route=/checkout --flag=checkout_redesign --step=5 --dry-run >/dev/null 2>&1
[ $? -eq 2 ] && pass "step 5 is blocked with no lower step migrated" || fail "step 5 was not blocked"

node -e "
  const fs = require('fs');
  const ledger = { project: 'proj', migrations: [{ route: '/about', flag: 'about_new', step: 1, state: 'migrated', writes_data: false, kind: 'read_only', flag_audit: [] }] };
  fs.writeFileSync('artifacts/website-loop/ROUTE_MIGRATION.json', JSON.stringify(ledger, null, 2));
"
node "$HERE/rollback.mjs" --project="$PROJ" --route=/about --reason=test --dry-run >/dev/null 2>&1
[ $? -eq 0 ] && pass "rollback dry-run on a migrated route is permitted" || fail "rollback dry-run was refused"

node "$HERE/rollback.mjs" --project="$PROJ" --route=/nothing --reason=test --dry-run >/dev/null 2>&1
[ $? -eq 2 ] && pass "rollback of an unknown route exits 2" || fail "unknown route did not exit 2"

node "$HERE/rollback.mjs" --project="$PROJ" --route=/about --reason="golden test failed" --yes >/dev/null 2>&1
RC=$?
if [ "$RC" -eq 0 ] || [ "$RC" -eq 1 ]; then pass "rollback recorded (exit $RC)"; else fail "rollback exited $RC"; fi
[ -s artifacts/website-loop/ROLLBACK.json ] && pass "ROLLBACK.json written" || fail "ROLLBACK.json missing"
if node -e "
  const r = JSON.parse(require('fs').readFileSync('artifacts/website-loop/ROLLBACK.json', 'utf8'));
  process.exit(r.targets[0].flipped === false && r.targets[0].requires_manual_flip === true ? 0 : 1);
"; then
  pass "rollback records that it did NOT flip the flag itself"
else
  fail "rollback claimed a flip it did not perform"
fi

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL PASS ($PASS)"; exit 0; fi
echo "$FAIL FAILURE(S), $PASS passed"
exit 1
