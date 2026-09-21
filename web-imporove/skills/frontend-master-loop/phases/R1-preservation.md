# R1 — Preservation

## Purpose
Capture baseline screenshots of every in-scope route, record Core Web Vitals metrics, and save component/route inventory before any change.

## Inputs
- Routes in scope (from APPROVALS.json)
- Dev/staging server URL
- Playwright or puppeteer instance

## Outputs
- artifacts/redesign/preservation/screenshots/*.png (one per route)
- artifacts/redesign/preservation/BASELINE_METRICS.json
- artifacts/redesign/preservation/ROUTE_INVENTORY.json

## Steps
1. Start dev/staging server.
2. For each route in scope:
   - Take full-page screenshot (1280px width).
   - Take mobile screenshot (375px width).
   - Record LCP, INP, CLS via Performance API.
   - Capture HTML source (for spec extraction in R2).
   - Capture component tree if possible (React DevTools protocol).
3. Record bundle size, build time, test pass rate.
4. Save all artifacts to preservation/ directory.

## Verification Checklist (15+)
1. Every route in scope has a desktop screenshot.
2. Every route in scope has a mobile screenshot.
3. LCP recorded for every route.
4. CLS recorded for every route.
5. INP recorded for every route (where possible).
6. Screenshots are not blank/error pages.
7. HTML source saved for every route.
8. Bundle size recorded.
9. Build time recorded.
10. Test pass rate recorded.
11. Component count recorded.
12. No broken images in screenshots.
13. Screenshot file size > 10KB (not empty).
14. ROUTE_INVENTORY has entries for all routes.
15. BASELINE_METRICS.json passes JSON.parse.

## Failure Modes
- Server won't start -> retry with alternative port (max 3).
- Route returns 404 -> log as error, capture error page.
- DevTools protocol not available -> skip component tree, log warning.
