#!/usr/bin/env bash
set -euo pipefail

# llm-fallback.sh — Verifies that an LLM fallback model is configured so agent
# runs do not fail hard when the primary provider is unavailable.
# Exit 0: Fallback is properly configured.
# Exit 1: Fallback is missing or misconfigured.

readonly DEFAULT_FALLBACK_MODEL="${OPENROUTER_FALLBACK_MODEL:-}"

errors_found=0

check_env() {
    if [[ -z "$DEFAULT_FALLBACK_MODEL" ]]; then
        echo "[VIOLATION] OPENROUTER_FALLBACK_MODEL is not set or empty." >&2
        errors_found=$((errors_found + 1))
    else
        echo "  OPENROUTER_FALLBACK_MODEL=$DEFAULT_FALLBACK_MODEL"
        echo "  [OK] Fallback model is configured."
    fi
}

check_template_exists() {
    local template_path="templates/python/shared/llm_client.py"
    if [[ ! -f "$template_path" ]]; then
        echo "[VIOLATION] LLM client template not found at $template_path" >&2
        errors_found=$((errors_found + 1))
    else
        # Verify it references the fallback model
        if grep -q "OPENROUTER_FALLBACK_MODEL" "$template_path" 2>/dev/null; then
            echo "  [OK] llm_client.py references OPENROUTER_FALLBACK_MODEL."
        else
            echo "[VIOLATION] llm_client.py does not reference OPENROUTER_FALLBACK_MODEL." >&2
            errors_found=$((errors_found + 1))
        fi

        # Verify it has a retry/fallback mechanism
        if grep -qE "(fallback|retry_on_failure|on_error_switch)" "$template_path" 2>/dev/null; then
            echo "  [OK] llm_client.py includes a retry/fallback mechanism."
        else
            echo "[VIOLATION] llm_client.py lacks explicit retry/fallback logic." >&2
            errors_found=$((errors_found + 1))
        fi
    fi
}

echo "Checking LLM fallback configuration..."

check_env
check_template_exists

if [[ $errors_found -gt 0 ]]; then
    echo "FAIL: $errors_found LLM fallback configuration issue(s)." >&2
    exit 1
fi

echo "PASS: LLM fallback is properly configured."
exit 0
