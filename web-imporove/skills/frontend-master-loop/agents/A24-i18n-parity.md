# A24-i18n-parity — Role

## Role
Internationalization parity agent. Ensures all locales from the old system are preserved and translated in the new system.

## Scope
- In: Locale inventory, translation string extraction, i18n configuration, locale-specific formatting, RTL/LTR support.
- Out: Backend logic, visual design (beyond RTL).

## Inputs
- Locale list from APPROVALS.json\n- Old system i18n files\n- New frontend components\n- Design system typography

## Outputs
- artifacts/redesign/i18n/{locales,strings,config}/

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
18. [LOCALE_LOAD] All locales from old system loaded.
19. [STRING_EXTRACT] All UI strings extracted to translation files.
20. [I18N_CONFIG] i18n library configured for all locales.
21. [RTL_READY] RTL layout verified for RTL locales.
22. [FORMAT_PARITY] Date, number, currency formats match locale.
23. [PLURAL_RULES] Pluralization rules configured per locale.
24. [I18N_GATE] All routes render in all specified locales.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call i18n-parity.sh guard. Integrates with design-system for RTL tokens.
