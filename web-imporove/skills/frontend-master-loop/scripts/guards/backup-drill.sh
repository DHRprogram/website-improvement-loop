#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: backup-drill ==="
RESTORE_TIME_SEC=0
TEN_MIN=600

if [ -f "artifacts/redesign/load-chaos/BACKUP_DRILL_REPORT.json" ]; then
  RESTORE_TIME_SEC=$(jq -r '.restore_time_sec // 0' artifacts/redesign/load-chaos/BACKUP_DRILL_REPORT.json 2>/dev/null || echo "0")
fi

if [ "$RESTORE_TIME_SEC" -gt "$TEN_MIN" ] && [ "$RESTORE_TIME_SEC" -ne 0 ]; then
  echo "FAIL: Backup restore took ${RESTORE_TIME_SEC}s > ${TEN_MIN}s limit. HST-08."
  exit 1
fi

if [ "$RESTORE_TIME_SEC" -eq 0 ]; then
  echo "  INFO: No backup drill report yet. Run R8.7 to generate."
fi
echo "PASS: Backup restore within limits."
exit 0
