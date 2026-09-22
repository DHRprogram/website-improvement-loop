#!/usr/bin/env bash
set -euo pipefail

# no-secrets.sh — Scans staged or specified files for known secret patterns.
# Exit 0: No secrets found (safe to commit).
# Exit 1: Secrets detected (abort operation).

readonly SECRETS_REGEX='(api[_-]?key|password|secret[_-]?key|token|credential|private[_-]?key)\s*[:=]\s*["\x27][^"\x27]+["\x27]'
readonly EXCLUDED_DIRS="node_modules|.git|venv|.tox|__pycache__"

scanned_files=0
violations_found=0

scan_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        scanned_files=$((scanned_files + 1))
        if grep -qInE "$SECRETS_REGEX" "$file" 2>/dev/null; then
            echo "[VIOLATION] $file"
            violations_found=$((violations_found + 1))
        fi
    fi
}

if [[ $# -eq 0 ]]; then
    # Default: scan git staged files
    while IFS= read -r -d '' file; do
        # Skip excluded directories
        skip=false
        for excl in $EXCLUDED_DIRS; do
            if [[ "$file" == *"/$excl/"* ]] || [[ "$file" == *"/$excl" ]]; then
                skip=true
                break
            fi
        done
        if ! $skip; then
            scan_file "$file"
        fi
    done < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | tr '\n' '\0')
else
    # Scan provided file paths
    for arg in "$@"; do
        if [[ -f "$arg" ]]; then
            scan_file "$arg"
        elif [[ -d "$arg" ]]; then
            while IFS= read -r -d '' file; do
                scan_file "$file"
            done < <(find "$arg" -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.json" \) -print0 2>/dev/null)
        else
            echo "[WARN] Path not found: $arg" >&2
        fi
    done
fi

echo "Scanned $scanned_files files."

if [[ $violations_found -gt 0 ]]; then
    echo "FAIL: $violations_found secret pattern(s) detected in staged files." >&2
    exit 1
fi

echo "PASS: No secrets detected in scanned files."
exit 0
