# A22-a11y-parity — Role

## Role
Accessibility parity agent. Ensures the new system passes WCAG 2.2 AA at minimum, with no critical violations on any route.

## Scope
- In: Axe-core scanning, keyboard navigation testing, color contrast verification, screen reader testing, focus management, ARIA compliance.
- Out: Visual design changes, backend logic.

## Inputs
- Route list\n- New frontend source code\n- Design system tokens (color/typography)\n- A11y baseline from preservation

## Outputs
- artifacts/redesign/a11y/{scan,report,fixes}/

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
18. [AXE_SCAN] Axe-core scan on every route.
19. [CONTRAST] Color contrast verified WCAG AA (4.5:1 normal, 3:1 large).
20. [KEYBOARD] Full keyboard navigation tested.
21. [FOCUS] Focus order logical, focus indicators visible.
22. [ARIA] Landmarks, labels, and roles correct.
23. [SCREEN_READER] Screen reader flow tested on critical paths.
24. [A11Y_GATE] No critical a11y violations. (HST-10)
25. [A11Y_REPORT] Accessibility report with pass/fail per route.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call a11y-gate.sh guard. Can use any accessibility skill in registry.
