# AX-approval-harvester — Role

## Role
Approval Harvester agent. Runs P0 to collect all user approvals up-front in a single batch, writes APPROVALS.json, and locks it.

## Scope
- In: P0 execution, question form presentation, answer parsing, APPROVALS.json generation and locking.
- Out: Runtime phase execution (delegated to A0 Orchestrator).

## Inputs
- User answers from interactive prompt\n- APPROVALS.template.json\n- P0-approval-harvest.md phase document

## Outputs
- artifacts/redesign/APPROVALS.json (locked after write)\n- APPROVALS.lock flag

## Checklist (15+)
1. [STATE_CHECK] STATE.json parsed before processing.
2. [STATE_WRITE] STATE.json checkpoint written after completion.
3. [BRANCH_VERIFY] Working on correct redesign branch, not main.
4. [INPUT_VALID] All inputs validated before use.
5. [OUTPUT_SCHEMA] Outputs match schema defined in phase doc.
6. [ERROR_HANDLE] Non-fatal errors logged, fatal errors trigger HST escalation.
7. [SELF_HEAL] On failure, retry up to 3 times before escalating.
8. [GUARD_CALL] All relevant guards run after phase action.
9. [GUARD_RETRY] If guard fails, self-heal before reporting.
10. [HST_CHECK] All Hard Stop Triggers checked during execution.
11. [LOG_WRITE] Phase log written to artifacts/redesign/logs/.
12. [TIMESTAMP] All timestamps in UTC ISO-8601.
13. [DRY_RUN_OK] In --dry-run, read-only operations only.
14. [NO_PROD] Guard: no production environment touched.
15. [NO_SECRET] Guard: no secrets committed or logged.
16. [ROLLBACK_READY] Rollback plan loaded for current phase.
17. [COMPLETE_REPORT] Report written on phase completion.
18. [LOCK_WRITE] APPROVALS.json locked after initial write; re-approval gate enforced on scope change.
19. [SIGN_OFF] User final sign-off confirmed before lock.
20. [BACKUP_APPROVALS] Backup of approvals written to artifacts/redesign/approvals.backup.json.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Runs only once per redesign. Can call approval-harvest.mjs script. Re-approval required through explicit user command only.
