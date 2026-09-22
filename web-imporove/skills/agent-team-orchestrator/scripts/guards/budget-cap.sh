#!/usr/bin/env bash
set -euo pipefail

# budget-cap.sh — Enforces spending limits per session against the total budget cap.
# Reads current spend from BUDGET_STATE_FILE or defaults to env var tracking.
# Exit 0: Current spend is within the budget cap.
# Exit 1: Budget limit would be exceeded by the requested amount.

readonly DEFAULT_CAP="${BUDGET_CAP_USD:-50.00}"
readonly STATE_DIR="${BUDGET_STATE_DIR:-.}"
readonly STATE_FILE="$STATE_DIR/budget-state.json"

# Parse optional argument for estimated cost of the upcoming task
estimated_cost="${TASK_ESTIMATED_COST:-0}"

get_current_spent() {
    if [[ -f "$STATE_FILE" ]]; then
        # Extract spent_usd from JSON using grep + sed (no jq dependency)
        local spent
        spent=$(grep -o '"spent_usd":[[:space:]]*[0-9.]*' "$STATE_FILE" | grep -o '[0-9.]*$' || echo "0")
        echo "${spent:-0}"
    else
        echo "0"
    fi
}

calculate_percentage() {
    local spent="$1"
    local cap="$2"
    awk "BEGIN { printf \"%.2f\", ($spent / $cap) * 100 }"
}

echo "Budget check: estimated task cost = \$$estimated_cost"

current_spent=$(get_current_spent)
cap=$DEFAULT_CAP
projected_spent=$(awk "BEGIN { printf \"%.2f\", $current_spent + $estimated_cost }")
percentage=$(calculate_percentage "$current_spent" "$cap")
remaining=$(awk "BEGIN { printf \"%.2f\", $cap - $current_spent }")

echo "  Current spent:   \$$current_spent"
echo "  Budget cap:      \$$cap"
echo "  Remaining:       \$$remaining"
echo "  Projected after task: \$$projected_spent"
echo "  Utilization:     ${percentage}%"

# Check thresholds
threshold_critical="90"
threshold_warning="75"
threshold_exceeded="100"

if (( $(echo "$percentage >= $threshold_critical" | bc -l 2>/dev/null || echo 0) )); then
    echo "[ALERT] Budget utilization at ${percentage}% (critical threshold: ${threshold_critical}%)" >&2
fi

if (( $(echo "$projected_spent > $cap" | bc -l 2>/dev/null || echo 0) )); then
    echo "FAIL: Estimated task cost would exceed budget cap." >&2
    echo "  Requested: \$$estimated_cost" >&2
    echo "  Remaining: \$$remaining" >&2
    exit 1
fi

# Write a warning marker if approaching limit
if (( $(echo "$percentage >= $threshold_warning" | bc -l 2>/dev/null || echo 0) )); then
    echo "[WARNING] Approaching budget limit. Consider reducing scope." >&2
fi

echo "PASS: Task cost within budget cap."
exit 0
