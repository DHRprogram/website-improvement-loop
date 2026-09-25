#!/usr/bin/env bash
# Refuse to let the loop touch a protected branch.
#   exit 0 -> current branch is safe to work on
#   exit 1 -> on main or master
set -uo pipefail

echo "=== guard: no-main-commit ==="

BRANCH="${WIL_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)}"
case "$BRANCH" in
  main|master|production|prod|release)
    echo "  VIOLATION: on protected branch '$BRANCH'"
    echo "FAIL: create a loop branch first:  git checkout -b loop/\$(date -u +%Y%m%d-%H%M%S)"
    exit 1
    ;;
esac

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "  not a git repository — nothing to guard"
  echo "PASS"
  exit 0
fi

echo "  branch: $BRANCH"
echo "PASS: safe to commit."
exit 0
