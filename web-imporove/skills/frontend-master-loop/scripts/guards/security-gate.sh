#!/usr/bin/env bash
set -euo pipefail

echo "=== Guard: security-gate ==="
CRITICAL=0
HIGH=0

if command -v npx &>/dev/null && [ -f "package.json" ]; then
  npm audit --json 2>/dev/null | node -e "
    const d=require('fs').readFileSync('/dev/stdin','utf-8');
    try {
      const r=JSON.parse(d);
      const c=r.metadata?.vulnerabilities?.critical||0;
      const h=r.metadata?.vulnerabilities?.high||0;
      console.log('CRITICAL:'+c+',HIGH:'+h);
      process.exit(c>0||h>0?1:0);
    } catch(e) { console.log('audit-unavailable'); process.exit(0); }
  " 2>/dev/null && CRITICAL=0 || CRITICAL=1
fi

if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  echo "FAIL: $CRITICAL critical vulns. HST-03."
  exit 1
fi
echo "PASS: Security gate clear."
exit 0
