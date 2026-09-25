#!/usr/bin/env bash
# Decide whether the improvement loop is finished.
#
#   exit 0 -> the loop is done, Claude may stop
#   exit 2 -> work remains, Claude must continue
#
# Reads STATE.md. With no STATE.md at all it returns 2: a loop that has not
# started yet must not be mistaken for a loop that has finished.
set -uo pipefail

WIL_DIR="${WIL_DIR:-artifacts/website-loop}"
STATE_FILE="${WIL_STATE:-${WIL_DIR}/STATE.md}"
STOP_FILE="${WIL_STOP:-${WIL_DIR}/STOP}"
STDERR_MSG=""

say() { STDERR_MSG="${STDERR_MSG}${1}"$'\n'; }

# Scalar read from the frontmatter block. Returns empty when absent, so a
# missing key is distinguishable from a zero value.
get() {
  [ -f "$STATE_FILE" ] || return 0
  sed -n '2,/^---$/p' "$STATE_FILE" \
    | sed -n "s/^$1:[[:space:]]*//p" \
    | head -n1 \
    | sed 's/^"//; s/"$//'
}

is_int() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

MAX_ITER=$(get max_iterations)
MIN_SEV=$(get min_severity)
ITER=$(get iteration_count)
OPEN=$(get open_findings)
STREAK=$(get no_improvement_streak)
ERRORS=$(get consecutive_errors)

[ -z "$MAX_ITER" ] && MAX_ITER=50
[ -z "$MIN_SEV" ] && MIN_SEV=P2
[ -z "$ITER" ] && ITER=0
[ -z "$OPEN" ] && OPEN=1
[ -z "$STREAK" ] && STREAK=0
[ -z "$ERRORS" ] && ERRORS=0

is_int "$MAX_ITER" || MAX_ITER=50
is_int "$ITER" || ITER=0
is_int "$OPEN" || OPEN=1
is_int "$STREAK" || STREAK=0
is_int "$ERRORS" || ERRORS=0

# 1. A human asked to stop. This always wins.
if [ -f "$STOP_FILE" ]; then
  REASON=$(get stop_reason)
  say "STOP sentinel present${REASON:+ — $REASON}. Loop finished."
  printf '%s' "$STDERR_MSG" >&2
  exit 0
fi

# 2. Iteration cap.
if [ "$ITER" -ge "$MAX_ITER" ]; then
  say "Stop condition: iteration cap reached ($ITER/$MAX_ITER). Loop finished."
  printf '%s' "$STDERR_MSG" >&2
  exit 0
fi

# 3. Nothing left at or above the severity floor.
#    A negative count means the queue has not been measured yet. That is not an
#    empty queue, so it must not end the loop.
if [ "$OPEN" -ge 0 ] && [ "$OPEN" -eq 0 ]; then
  say "Stop condition: no open findings at or above $MIN_SEV. Loop finished."
  printf '%s' "$STDERR_MSG" >&2
  exit 0
fi

# 4. Plateau — five iterations with no metric improvement.
if [ "$STREAK" -ge 5 ]; then
  say "Stop condition: $STREAK consecutive iterations with no metric improvement. Loop finished."
  printf '%s' "$STDERR_MSG" >&2
  exit 0
fi

# 5. Repeated failure — three consecutive errored iterations.
if [ "$ERRORS" -ge 3 ]; then
  say "Stop condition: $ERRORS consecutive failed iterations. Stopping to report rather than loop."
  printf '%s' "$STDERR_MSG" >&2
  exit 0
fi

# Not finished. The caller continues.
say "Loop continues: iteration $ITER/$MAX_ITER, $OPEN open finding(s) at or above $MIN_SEV."
printf '%s' "$STDERR_MSG" >&2
exit 2
