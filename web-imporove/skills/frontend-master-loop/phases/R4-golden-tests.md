# R4 — Golden Tests

## Purpose
Record per-route golden tests (visual + behavioral) against the existing site before changes begin.

## Inputs
- Route list from ROUTE_MAP
- Dev server URL
- Playwright/browser access

## Outputs
- artifacts/redesign/golden-tests/GOLDEN_TESTS.json
- artifacts/redesign/golden-tests/snapshots/*.snap (visual)
- artifacts/redesign/golden-tests/behaviors/*.json (behavioral)

## Steps
1. For each route, create a golden test:
   - Navigate to route.
   - Take screenshot (full page + viewport).
   - Record DOM structure hash.
   - Record network requests (URLs, status codes).
   - Record console messages (no errors).
   - Record performance marks.
   - Record accessibility tree (aXe results).
2. For each interactive element:
   - Click, type, submit and record outcome.
   - Record page state changes.
3. Write all golden data to GOLDEN_TESTS.json.
4. Guard: golden-tests-must-pass.sh uses these as reference.

## Verification Checklist (15+)
1. Every route has a golden test entry.
2. Every entry has screenshot (viewport).
3. Every entry has DOM hash.
4. Every entry has network request list.
5. Every entry has console message list (must be clean).
6. Every entry has aXe results.
7. Interactive elements tested per route.
8. Form submissions recorded.
9. Error pages tested (404, 500).
10. Loading states tested.
11. Empty states tested.
12. Authentication states captured.
13. Mobile viewport per route.
14. GOLDEN_TESTS.json passes JSON.parse.
15. Snapshots directory structured by route.

## Failure Modes
- Route not accessible -> test error page, log.
- Dynamic content (real data) -> test with known fixtures/stubs.
- 3rd-party widgets -> mock or skip with annotation.

## Checklist
1. Screenshot taken for every route (full page + viewport at 3 breakpoints).
2. DOM structure hash computed and stored per route.
3. Network requests logged with URLs, methods, status codes.
4. Console messages captured — no errors present.
5. AXe accessibility scan run on each route.
6. LCP, FID, CLS measured and stored as baseline.
7. Interactive element states recorded (hover, focus, disabled).
8. Form validation behavior tested and documented.
9. SPA navigation paths traversed and recorded.
10. Route-level golden tests stored as separate JSON files.
11. Visual comparison baseline images checked into git.
12. Golden test runner script validated (node --check passes).
13. Test data isolated (no production data used).
14. Golden test results included in ARTIFACTS directory.
15. All golden tests pass before any code changes begin.

## Rollback
- Golden tests read-only; no code changes made during collection.
- If browser automation fails after 3 attempts, save partial baseline and continue.
- Remove snapshots directory and re-run if corruption detected.
