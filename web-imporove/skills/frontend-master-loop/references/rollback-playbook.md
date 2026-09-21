# Rollback Playbook

## SLA Targets
- < 5 seconds: feature flag flip (toggle old code)
- < 5 minutes: git revert of last commit
- < 10 minutes: backup restore

## Rollback Triggers
1. Golden test failure -> revert commit + flip flag
2. SLO error budget > 25% -> flip flag to 0% new traffic
3. Security vulnerability -> revert + block route
4. Data contract drift -> revert migration
5. Cost delta > approved -> revert recent changes

## Procedure
1. Identify the offending change (route, commit, or flag).
2. Flip the feature flag to 0% for that route.
3. If commit-level rollback needed: git revert --no-edit HEAD.
4. Verify rollback by re-running golden tests against old code.
5. Write ROLLBACK_REPORT.md.
6. If backup restore needed: restore from last backup, verify integrity.
