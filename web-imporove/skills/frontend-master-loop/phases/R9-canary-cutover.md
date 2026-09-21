# R9 — Canary Cutover

## Purpose
Paced rollout of the redesigned routes through a canary ladder: 1% -> 5% -> 25% -> 50% -> 100%. Only proceeds if canary consent was given in P0.

## Inputs
- APPROVALS.json (D3 canary consent)
- All migrated routes from R8
- Feature flag provider
- APM/observability stack

## Outputs
- artifacts/redesign/canary/CANARY_LOG.json
- artifacts/redesign/canary/TRAFFIC_STATE.json

## Steps
1. Verify canary ladder consent from P0 (D3).
2. Set flag to 1% of traffic.
3. Monitor for monitoring window (default 15min):
   - Error rate < baseline + 1%.
   - Latency p95 < baseline + 20%.
   - No HST triggers.
4. If pass, promote to 5%.
5. Monitor 30min.
6. If pass, promote to 25%.
7. Monitor 60min.
8. If pass, promote to 50%.
9. Monitor 120min.
10. If pass, promote to 100%.
11. Monitor 240min.
12. Write CANARY_LOG.json.

## Verification Checklist (15+)
1. Canary consent verified.
2. Canary ladder respected (no skip levels).
3. 1% step monitored for full window.
4. 5% step monitored for full window.
5. 25% step monitored for full window.
6. 50% step monitored for full window.
7. 100% step monitored for full window.
8. Error rate < baseline + 1% at every step.
9. Latency p95 < baseline + 20%.
10. No HST fired.
11. Rollback plan documented.
12. Traffic state logged at each step.
13. CANARY_LOG.json passes JSON.parse.
14. TRAFFIC_STATE.json passes JSON.parse.
15. Auto-rollback configured if error budget breached.

## Failure Modes
- Error budget consumed > 25% -> HST-02, auto-rollback.
- Latency spike > 2x baseline -> auto-rollback step.
- Security incident -> HST-03, immediate rollback.
- User must be present for each step? No — autonomous if consented.
