# R0 — Preflight

## Purpose
Validate environment, tools, access rights, and backup status before any redesign work begins.

## Inputs
- APPROVALS.json (from P0)
- Repo git state

## Outputs
- artifacts/redesign/PREFLIGHT_CHECKLIST.json

## Steps
1. Verify git working tree is clean or stash changes.
2. Verify all required tools: node, npm, git, gh, bash, psql/sqlite3, jq.
3. Verify NODE_VERSION >= 18.
4. Verify DATABASE_URL in .env or env (staging URL from approvals).
5. If backup_target_confirmed: verify backup target accessible.
6. Create redesign branch: `redesign/<mode>/<YYYY-MM-DD-HHmm>`.
7. Verify feature flag provider is reachable.
8. Verify no production hostnames in .env or config.
9. Run guards/no-prod-touch.sh and guards/no-secret-commit.sh.
10. Write preflight checklist.

## Verification Checklist (15+)
1. node --version >= 18.
2. npm --version >= 9.
3. git status is clean.
4. Branch created on correct base.
5. DATABASE_URL points to staging (not prod).
6. Feature flag provider reachable.
7. All guard scripts executable.
8. .env.production does NOT contain "production" host.
9. No staged secrets.
10. Backup target writable.
11. jq installed.
12. gh auth status passes (if GH_TOKEN available).
13. disk space > 5GB free.
14. Node memory > 2GB.
15. Timezone UTC for timestamps.

## Failure Modes
- Dirty git working tree -> stash with named stash or abort.
- Missing tool -> install and retry (max 3 attempts).
- Production hostname detected -> HST-06 triggered.
- Backup unreachable -> warn but can proceed (unless confirmed in P0).
