#!/usr/bin/env bash
# no-schema-change.sh — enforce the frozen data contract.
#
#   no-schema-change.sh [project_root]
#
# The contract lives at artifacts/website-loop/DATA_CONTRACT.json and is
# committed. A change to it is legitimate (that is how a version bump happens)
# but it must be accompanied by an approval record in APPROVALS.json naming the
# new version, or the commit fails.
#
# exit 0 unchanged or approved | 1 unapproved change | 2 bad usage or unreadable
set -uo pipefail

ROOT="${1:-.}"
CONTRACT_REL="artifacts/website-loop/DATA_CONTRACT.json"
APPROVALS_REL="artifacts/website-loop/APPROVALS.json"

if [ ! -d "$ROOT" ]; then
  echo "no-schema-change: '$ROOT' is not a directory" >&2
  exit 2
fi

CONTRACT="$ROOT/$CONTRACT_REL"
APPROVALS="$ROOT/$APPROVALS_REL"

# A deletion is checked BEFORE the missing-file case, and the order matters.
# Deleting the contract removes the file from disk, so the "nothing frozen yet"
# early-return below would otherwise fire first and wave the deletion through.
# Removing the guarantee is exactly the change this guard exists to catch.
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  if git -C "$ROOT" show HEAD:"$CONTRACT_REL" >/dev/null 2>&1; then
    if git -C "$ROOT" diff --cached --name-only --diff-filter=D -- "$CONTRACT_REL" 2>/dev/null | grep -q .; then
      echo "=== guard: no-schema-change ==="
      echo "FAIL: $CONTRACT_REL is staged for deletion."
      echo "Deleting the contract removes the guarantee it provided. Revert the deletion."
      exit 1
    fi
  fi
fi

# Nothing frozen at all means nothing to protect. Exit 0, and say so, so a
# missing contract is a visible state rather than a silent pass.
if [ ! -f "$CONTRACT" ]; then
  echo "no-schema-change: no $CONTRACT_REL — nothing is frozen yet. Nothing to guard."
  exit 0
fi

if ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$CONTRACT" 2>/dev/null; then
  echo "=== guard: no-schema-change ==="
  echo "FAIL: $CONTRACT_REL exists but is not valid JSON."
  echo "A contract that cannot be parsed is not an unchanged contract. Failing closed."
  exit 2
fi

VERSION=$(node -e "
  try { const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
        process.stdout.write(String(c.contract_version||'')); } catch { process.stdout.write(''); }
" "$CONTRACT")

if [ -z "$VERSION" ]; then
  echo "=== guard: no-schema-change ==="
  echo "FAIL: $CONTRACT_REL has no contract_version."
  exit 2
fi

# A change to the contract file itself.
CHANGED=0
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  if ! git -C "$ROOT" diff --quiet --cached -- "$CONTRACT_REL" 2>/dev/null; then
    CHANGED=1
  elif ! git -C "$ROOT" diff --quiet -- "$CONTRACT_REL" 2>/dev/null; then
    CHANGED=1
  fi
fi

if [ "$CHANGED" -eq 0 ]; then
  echo "no-schema-change: contract $VERSION unchanged. OK."
  exit 0
fi

echo "no-schema-change: contract changed to $VERSION. Checking approvals."

if [ ! -f "$APPROVALS" ]; then
  echo "=== guard: no-schema-change ==="
  echo "FAIL: the contract changed but $APPROVALS_REL does not exist."
  echo "Record an approval for $VERSION before changing a frozen contract."
  exit 1
fi

APPROVED=$(node -e "
  try {
    const a=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
    const list=Array.isArray(a)?a:(a.approvals||[]);
    const hit=list.some(x => String(x.contract_version||'')===process.argv[2]
                        && String(x.approver||'').trim()!==''
                        && String(x.reason||'').trim()!=='');
    process.stdout.write(hit?'yes':'no');
  } catch { process.stdout.write('no'); }
" "$APPROVALS" "$VERSION")

if [ "$APPROVED" = "yes" ]; then
  echo "no-schema-change: contract $VERSION is approved. OK."
  exit 0
fi

echo "=== guard: no-schema-change ==="
echo "FAIL: the contract changed to $VERSION with no matching approval."
echo "Add to $APPROVALS_REL:"
echo '  { "contract_version": "'"$VERSION"'", "approver": "<a person>", "reason": "<why>", "date": "<YYYY-MM-DD>" }'
echo "See references/data-contract-rules.md for what may change without approval."
exit 1
