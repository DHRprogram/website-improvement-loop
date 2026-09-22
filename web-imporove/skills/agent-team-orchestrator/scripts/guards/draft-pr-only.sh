#!/usr/bin/env bash
set -euo pipefail

# draft-pr-only.sh — Ensures the git bridge service only opens draft pull
# requests. It must never contain logic to merge, close, or push to main.
# Exit 0: Draft PR policy enforced.
# Exit 1: Draft policy violation detected.

readonly BRIDGE_DIR="templates/python/services/git_bridge"

errors_found=0

check_merge_calls() {
    # Check that no file calls .merge() (PR auto-merge)
    local found_merge=false
    while IFS= read -r file; do
        if grep -qE "\.merge\(" "$file" 2>/dev/null; then
            echo "[VIOLATION] Draft PR policy violated — merge() call found in $file" >&2
            found_merge=true
        fi
    done < <(find "$BRIDGE_DIR" -name "*.py" -type f 2>/dev/null)

    if $found_merge; then
        errors_found=$((errors_found + 1))
    else
        echo "  [OK] No .merge() calls found in git bridge."
    fi
}

check_close_calls() {
    # Check that no file calls .close() on a pull request object
    local found_close=false
    while IFS= read -r file; do
        if grep -qE "\.close\(" "$file" 2>/dev/null; then
            # Exclude generic resource cleanup like response.close() or session.close()
            if grep -qE "(pull_request\.close|pr\.close|draft_pull\.close)" "$file" 2>/dev/null; then
                echo "[VIOLATION] Draft PR policy violated — PR close() call found in $file" >&2
                found_close=true
            fi
        fi
    done < <(find "$BRIDGE_DIR" -name "*.py" -type f 2>/dev/null)

    if $found_close; then
        errors_found=$((errors_found + 1))
    else
        echo "  [OK] No PR close() calls found in git bridge."
    fi
}

check_push_to_main() {
    # Check that no file pushes directly to the main branch
    local found_push=false
    while IFS= read -r file; do
        if grep -qE "(push.*main|force_push.*main|create_ref.*main)" "$file" 2>/dev/null; then
            echo "[VIOLATION] Draft PR policy violated — push-to-main logic found in $file" >&2
            found_push=true
        fi
    done < <(find "$BRIDGE_DIR" -name "*.py" -type f 2>/dev/null)

    if $found_push; then
        errors_found=$((errors_found + 1))
    else
        echo "  [OK] No push-to-main logic found in git bridge."
    fi
}

check_draft_flag() {
    # Verify the main creation function sets draft=True
    local github_file="$BRIDGE_DIR/github.py"
    if [[ -f "$github_file" ]]; then
        if grep -qE "(draft\s*=\s*True|draft=True)" "$github_file" 2>/dev/null; then
            echo "  [OK] github.py sets draft=True for created PRs."
        else
            echo "[VIOLATION] github.py does not explicitly set draft=True." >&2
            errors_found=$((errors_found + 1))
        fi
    else
        echo "[WARN] github.py not found at $github_file; cannot verify draft flag." >&2
        errors_found=$((errors_found + 1))
    fi
}

echo "Checking draft PR policy in git bridge..."

check_draft_flag
check_merge_calls
check_close_calls
check_push_to_main

if [[ $errors_found -gt 0 ]]; then
    echo "FAIL: $errors_found draft PR policy violation(s) detected." >&2
    exit 1
fi

echo "PASS: Git bridge enforces draft PR policy."
exit 0
