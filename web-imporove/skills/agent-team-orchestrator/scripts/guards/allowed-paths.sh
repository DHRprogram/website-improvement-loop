#!/usr/bin/env bash
set -euo pipefail

# allowed-paths.sh — Validates that file operations stay within permitted paths.
# Usage:
#   Allowed paths are defined in the TASK_ALLOWED_PATHS environment variable
#   as a colon-separated list, e.g., /workspace/src:/workspace/tests
# Exit 0: All referenced paths are within the allowed set.
# Exit 1: Unauthorized path access detected.

readonly ALLOWED_PATHS="${TASK_ALLOWED_PATHS:-}"

if [[ -z "$ALLOWED_PATHS" ]]; then
    echo "[WARN] TASK_ALLOWED_PATHS not set; skipping path validation." >&2
    exit 0
fi

validate_paths() {
    local files_to_check="$1"
    local violations=0

    if [[ ! -f "$files_to_check" ]]; then
        echo "[ERROR] Files list not found: $files_to_check" >&2
        exit 1
    fi

    while IFS= read -r filepath; do
        # Skip empty lines
        [[ -z "$filepath" ]] && continue

        local matched=false
        IFS=':' read -ra PATH_ARRAY <<< "$ALLOWED_PATHS"
        for allowed in "${PATH_ARRAY[@]}"; do
            # Path must start with the allowed prefix (with or without trailing slash)
            case "$filepath" in
                ${allowed}|${allowed}/*)
                    matched=true
                    break
                    ;;
            esac
        done

        if ! $matched; then
            echo "[VIOLATION] File outside allowed paths: $filepath" >&2
            violations=$((violations + 1))
        fi
    done < "$files_to_check"

    return $violations
}

check_symlinks() {
    # Check for symlinks that could bypass path restrictions
    local search_dir="$1"
    if [[ -d "$search_dir" ]]; then
        while IFS= read -r -d '' link; do
            local target
            target=$(readlink -f "$link" 2>/dev/null || echo "")
            case "$target" in
                ${ALLOWED_PATHS}*) ;;
                *)
                    echo "[VIOLATION] Symlink escapes allowed paths: $link -> $target" >&2
                    errors_found=$((errors_found + 1))
                    ;;
            esac
        done < <(find "$search_dir" -type l -print0 2>/dev/null)
    fi
}

echo "Validating file paths against allowed set..."

errors_found=0

# Validate individual files passed as arguments
for arg in "$@"; do
    if [[ -f "$arg" ]]; then
        validate_paths "$arg" || errors_found=$?
    elif [[ -d "$arg" ]]; then
        check_symlinks "$arg"
    else
        echo "[WARN] Path not found: $arg" >&2
    fi
done

if [[ $errors_found -gt 0 ]]; then
    echo "FAIL: $errors_found unauthorized path access(es) detected." >&2
    exit 1
fi

echo "PASS: All file operations within allowed paths."
exit 0
