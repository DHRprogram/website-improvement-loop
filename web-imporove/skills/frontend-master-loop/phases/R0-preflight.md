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

## Checklist
1. [ENV_NODE] Node.js >= 20 installed and accessible.
2. [ENV_PYTHON] Python >= 3.11 installed and accessible.
3. [ENV_BASH] Bash >= 5 installed and accessible.
4. [GIT_BRANCH] On dedicated branch, not main.
5. [GH_AUTH] GitHub token available for PR operations.
6. [STAGING_URL] Staging URL configured in APPROVALS.json.
7. [STAGING_DB] Staging database accessible.
8. [BACKUP_TARGET] Backup target confirmed and writable.
9. [FEATURE_FLAG_PROVIDER] Feature flag provider configured.
10. [APM_CONFIGURED] APM agent configured on staging.
11. [STATUS_PAGE] Status page URL configured.
12. [TOOLS_VALIDATED] All scripts pass syntax checks (node --check, bash -n).
13. [NO_PROD_URL] No production URL references found in config.
14. [ARTIFACTS_DIR] artifacts/redesign/ directory created.
15. [LOCKFILE_CHECK] Package lockfiles examined for known CVEs.

## Rollback
- If preflight detects blocking issue, print error and halt.
- If non-critical issues detected, warn but proceed with caution flags.
- No state changes made during preflight; full reversal always trivial.
