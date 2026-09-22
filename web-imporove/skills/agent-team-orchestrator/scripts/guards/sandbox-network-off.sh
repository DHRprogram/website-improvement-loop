#!/usr/bin/env bash
set -euo pipefail

# sandbox-network-off.sh -- Verifies that sandbox container templates enforce network isolation.
# Checks Docker Compose sandbox config for port mappings and host network mode.
# Checks template code for network_disabled=True parameter.
# Exit 0: All checks pass (sandbox is isolated).
# Exit 1: Network exposure detected.

readonly COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

errors_found=0

check_compose() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        echo "[WARN] Compose file not found: $COMPOSE_FILE" >&2
        return 0
    fi

    # Detect sandbox section in compose file
    local in_sandbox=false
    while IFS= read -r line; do
        if [[ "$line" == "  sandbox:" ]]; then
            in_sandbox=true
            continue
        fi
        if $in_sandbox; then
            # End of sandbox section: new service key at same indent level
            if [[ "$line" =~ ^\ \ [a-z].*: ]] && [[ ! "$line" =~ ^\ \ \ +[a-z] ]]; then
                in_sandbox=false
                continue
            fi
            # Check for ports mapping (dangerous!)
            if [[ "$line" =~ ^\ \ \ \ ports: ]]; then
                echo "[VIOLATION] Sandbox service exposes port mappings in compose file" >&2
                errors_found=$((errors_found + 1))
            fi
            # Check for network_mode: host
            if [[ "$line" =~ ^\ \ \ \ network_mode:\ *host ]]; then
                echo "[VIOLATION] Sandbox uses host network mode" >&2
                errors_found=$((errors_found + 1))
            fi
        fi
    done < "$COMPOSE_FILE"
}

check_service_code() {
    local sandbox_dir="templates/python/services/sandbox"

    if [[ ! -d "$sandbox_dir" ]]; then
        echo "[WARN] Sandbox template directory not found: $sandbox_dir" >&2
        return 0
    fi

    local found=false
    while IFS= read -r file; do
        if grep -q "network_disabled" "$file" 2>/dev/null; then
            found=true
            break
        fi
    done < <(find "$sandbox_dir" -name "*.py" -type f 2>/dev/null)

    if ! $found; then
        echo "[VIOLATION] Cannot verify network_disabled in $sandbox_dir" >&2
        errors_found=$((errors_found + 1))
    fi

    local found_param=false
    while IFS= read -r file; do
        if grep -qE "(network_disabled|network_mode.*bridge)" "$file" 2>/dev/null; then
            found_param=true
            break
        fi
    done < <(find "$sandbox_dir" -name "*.py" -type f 2>/dev/null)

    if ! $found_param; then
        echo "[VIOLATION] Sandbox code missing explicit network isolation parameter" >&2
        errors_found=$((errors_found + 1))
    fi
}

echo "Checking sandbox network isolation..."

check_compose
check_service_code

echo "Scanned sandbox configuration."

if [[ $errors_found -gt 0 ]]; then
    echo "FAIL: $errors_found network isolation violation(s) detected." >&2
    exit 1
fi

echo "PASS: Sandbox network isolation verified."
exit 0
