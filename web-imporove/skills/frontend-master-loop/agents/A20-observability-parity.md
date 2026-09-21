# A20-observability-parity — Role

## Role
Observability parity agent. Ensures monitoring, logging, tracing, and alerting cover the new system at least as well as the old.

## Scope
- In: Logging parity check, metrics coverage, tracing setup, alert configuration, dashboard creation, SLO definition.
- Out: Code implementation, design decisions.

## Inputs
- Old system observability config\n- New system architecture\n- APM provider details from APPROVALS.json\n- Route list

## Outputs
- artifacts/redesign/observability/{dashboards,alerts,slos}/

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
18. [LOG_COVERAGE] All new services have structured logging.
19. [METRIC_COVERAGE] All critical metrics migrated (latency, error rate, throughput).
20. [TRACE_SETUP] Distributed tracing for cross-service requests.
21. [DASHBOARD_MIGRATED] Dashboards recreated for new system.
22. [ALERT_MIGRATED] All critical alerts migrated.
23. [SLO_DEFINED] SLO targets defined for each service.
24. [O11Y_PARITY] Observability parity checklist signed off.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call observability-parity.sh guard. Integrates with APM provider.
