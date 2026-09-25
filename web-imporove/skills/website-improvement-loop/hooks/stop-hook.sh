#!/usr/bin/env bash
# Claude Code Stop hook for the website-improvement-loop.
#
# Contract: exit 0 lets Claude stop, exit 2 blocks the stop and tells Claude
# to keep working. The message goes to stderr because that is what the hook
# protocol surfaces back to the model.
#
# Input on stdin: {"session_id": "<hex>", "transcript_path": "<path>"}
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "$HOOK_DIR/.." && pwd)"
CHECK="$HOOK_DIR/check-stop.sh"

if [ ! -x "$CHECK" ]; then
  # Tolerate a non-executable checkout rather than blocking the session.
  CHECK="bash $HOOK_DIR/check-stop.sh"
fi

# Drain stdin so the parent never blocks on an unread pipe. The payload is
# logged only when explicitly requested; it can contain transcript paths.
INPUT=""
if [ ! -t 0 ]; then
  INPUT="$(cat 2>/dev/null || true)"
fi

if [ -n "${WIL_DEBUG:-}" ]; then
  printf 'stop-hook: session payload received (%s bytes)\n' "${#INPUT}" >&2
fi

set +e
bash "$CHECK"
RC=$?
set -e

case "$RC" in
  0)
    printf '%s\n' "website-improvement-loop: stop condition met." >&2
    exit 0
    ;;
  2)
    printf '%s\n' "website-improvement-loop: stop condition NOT met — continue the loop. Read $SKILL_ROOT/SKILL.md and run the next iteration." >&2
    exit 2
    ;;
  *)
    # A broken guard must never wedge the session. Fail open and say so.
    printf 'website-improvement-loop: check-stop.sh returned %s; failing open so the session is not blocked.\n' "$RC" >&2
    exit 0
    ;;
esac
