#!/usr/bin/env bash
# Reject a change that made a metric worse.
#
#   metric-must-improve.sh <metric> <before> <after> [direction]
#
# <before> and <after> are either numbers, or paths to JSON files from which
# <metric> is read. A null in either file means the measuring tool is absent,
# not that the value is perfect, so the comparison is SKIPPED rather than
# guessed.
#
#   exit 0 -> same or better, or not comparable
#   exit 1 -> the metric regressed
set -uo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: metric-must-improve.sh <metric> <before> <after> [lower|higher]" >&2
  exit 2
fi

METRIC="$1"
BEFORE="$2"
AFTER="$3"
DIRECTION="${4:-auto}"

read_metric() { # read_metric <value-or-json-path> -> prints number, or "null"
  local src="$1"
  if [ -f "$src" ] && [ "${src##*.}" = "json" ]; then
    node -e '
      const fs = require("fs");
      const [file, key] = process.argv.slice(1);
      try {
        const d = JSON.parse(fs.readFileSync(file, "utf8"));
        const v = d[key];
        if (v === null || v === undefined) { process.stdout.write("null"); }
        else if (typeof v === "number") { process.stdout.write(String(v)); }
        else { process.stdout.write("null"); }
      } catch { process.stdout.write("null"); }
    ' "$src" "$METRIC" 2>/dev/null || echo "null"
  else
    printf '%s' "$src"
  fi
}

B="$(read_metric "$BEFORE")"
A="$(read_metric "$AFTER")"

if [ "$B" = "null" ] || [ "$A" = "null" ]; then
  echo "SKIP $METRIC: not measured in both snapshots (before=$B after=$A). Absent tool is not a perfect score."
  exit 0
fi

case "$B$A" in
  *[!0-9.eE+-]*) echo "FAIL $METRIC: non-numeric values (before=$B after=$A)" >&2; exit 2 ;;
esac

if [ "$DIRECTION" = "auto" ]; then
  case "$METRIC" in
    bundle_kb|lcp_ms|cls_score|inp_ms|axe_critical|axe_serious|contrast_failures|\
    runtime_errors|logic_bugs|race_conditions|xss_risks|csrf_risks|secrets_in_client|\
    lint_errors|type_errors|build_time_ms|heading_order_violations|\
    design_system_violations|spacing_inconsistencies|typography_violations|\
    ux_state_gaps|coupling_violations|critical_path_coverage|parity_violations)
      DIRECTION="lower" ;;
    test_pass_rate|meta_coverage|og_coverage|rubric_total|responsive_violations)
      DIRECTION="higher" ;;
    *) DIRECTION="lower" ;;
  esac
fi

case "$DIRECTION" in
  lower)  WORSE="$(node -e "process.stdout.write(String($A > $B))")" ;;
  higher) WORSE="$(node -e "process.stdout.write(String($A < $B))")" ;;
  *) echo "invalid direction '$DIRECTION' (use lower or higher)" >&2; exit 2 ;;
esac

DELTA="$(node -e "process.stdout.write((($A - $B)).toFixed(2))")"

if [ "$WORSE" = "true" ]; then
  echo "FAIL $METRIC regressed: $B -> $A (delta $DELTA, lower-is-better assumed '$DIRECTION')."
  exit 1
fi

echo "PASS $METRIC: $B -> $A (delta $DELTA, $DIRECTION is better)."
exit 0
