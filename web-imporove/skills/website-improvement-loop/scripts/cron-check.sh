#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?BASE_URL required}"
BUDGET="${BUDGET:-10}"
PROJECT="${PROJECT:-default}"
OUT="artifacts/CRON_${PROJECT}_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$OUT"
echo "==> Cron check: $(date -u)"

# Phase A — single iteration (--fast)
echo "==> Running --fast improvement"
bash scripts/measure.sh "cron_${PROJECT}_$(date +%Y%m%d)"
# Phase B — axe only (fastest signal)
echo "==> Running axe audit"
node scripts/user-test/run-axe.mjs "$BASE_URL" / 2>&1 || true

# Check score regression
OLD_SCORE="$(cat .claude/baselines/${PROJECT}/score.txt 2>/dev/null || echo "")"
NEW_SCORE=$(node -e "try{const m=require('fs').readdirSync('metrics').filter(f=>f.endsWith('.json')).sort().pop();const d=JSON.parse(require('fs').readFileSync('metrics/'+m,'utf8'));console.log(d.bundle_kb||0)}catch(e){console.log('0')}")

if [ -n "$OLD_SCORE" ] && [ "$NEW_SCORE" -gt "$((OLD_SCORE + 10))" ]; then
  echo "==> [ALERT] Score degraded: $OLD_SCORE → $NEW_SCORE"
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -sf -X POST -H "Content-Type: application/json" \
      -d "{\"text\":\"Website Improvement Loop: score degraded on ${PROJECT}: ${OLD_SCORE} → ${NEW_SCORE}\"}" \
      "$SLACK_WEBHOOK" 2>/dev/null || echo "Slack notify failed"
  fi
else
  echo "==> Score stable: $OLD_SCORE → $NEW_SCORE"
fi
echo "$NEW_SCORE" > ".claude/baselines/${PROJECT}/score.txt"
echo "==> Cron check done"
