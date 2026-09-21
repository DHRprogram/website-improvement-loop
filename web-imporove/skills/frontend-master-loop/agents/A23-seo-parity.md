# A23-seo-parity — Role

## Role
SEO parity agent. Ensures the new system maintains or improves SEO meta tags, structured data, sitemaps, and Core Web Vitals.

## Scope
- In: Meta tag verification, structured data validation, sitemap generation, robots.txt, canonical URLs, Core Web Vitals measurement, redirect mapping.
- Out: Backend logic, infrastructure.

## Inputs
- Route list\n- Old system SEO config\n- New frontend output\n- Preservation SEO snapshots from R1

## Outputs
- artifacts/redesign/seo/{meta,structured,sitemap,redirects}/

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
18. [META_TAGS] All routes have title, description, OG tags.
19. [STRUCTURED_DATA] JSON-LD/BreadcrumbList on all appropriate pages.
20. [SITEMAP] Sitemap generated and valid.
21. [ROBOTS_TXT] robots.txt correct per environment.
22. [CANONICAL] Canonical URLs on all pages.
23. [REDIRECT_MAP] Old→new URL redirect map complete.
24. [CWV_BASELINE] Core Web Vitals measured and >= old system.

## Failure Modes
- Input missing or malformed -> log and abort phase with rollback.
- Guard failure -> self-heal up to 3, then Hard Stop.
- Git conflict -> abort operation, log manual-intervention-needed.
- Phase dependency missing -> skip phase with warning, flag in report.

## Composition Notes
Can call seo-gate.sh guard. Can use any SEO skill in registry.
