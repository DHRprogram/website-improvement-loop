# R7 — Frontend Rebuild

## Purpose
Rebuild frontend routes using the new design system and component library while preserving all functionality and behavior.

## Inputs
- COMPONENT_TREE.json from R2
- ROUTE_MAP from R2
- TOKENS.json from R5
- Golden test references from R4

## Outputs
- New frontend files (on redesign branch)
- artifacts/redesign/frontend/ROUTE_MIGRATION_LOG.json

## Steps
1. For each route in scope:
   - Rebuild page component using new design system tokens.
   - Rebuild child components.
   - Wire to backend api (same endpoints from R6).
   - Apply i18n keys from original.
   - Apply analytics events from original.
   - Apply SEO meta from original.
   - Run golden test comparison.
2. Port forms, interactions, and state management.
3. Run a11y gate after each route.
4. Run golden test runner after each route.

## Verification Checklist (15+)
1. Every route from ROUTE_MAP rebuilt.
2. Design system tokens used (no hardcoded values).
3. i18n parity maintained.
4. Analytics parity maintained.
5. SEO meta parity maintained.
6. a11y gate passes (no critical violations).
7. Golden tests pass (visual + behavioral).
8. All interactive elements functional.
9. Form validation works.
10. Loading states implemented.
11. Error states implemented.
12. Empty states implemented.
13. Mobile responsive verified.
14. keyboard navigation verified.
15. Route-level code-splitting applied.

## Failure Modes
- Complex UI behavior -> verify against golden tests.
- Third-party widgets -> wrap with same interface.
- a11y gate failure -> HST-10 if critical.

## Checklist
1. Components rebuilt using new design system tokens.
2. All interactive elements tested across breakpoints.
3. Accessibility audit passes WCAG 2.2 AA for new components.
4. SEO metadata preserved (title, description, Open Graph tags).
5. Analytics events tracked with same identifiers as legacy.
6. Bundle size within budget (checked with bundle analyzer).
7. Lazy loading configured for route-level code splitting.
8. Error boundaries wrap all route groups.
9. Loading states match UX specification.
10. Focus management implemented for keyboard navigation.
11. Touch targets meet minimum 44x44px for mobile.
12. Image optimization pipeline active (responsive srcset).
13. Font loading strategy prevents FOIT/FOUT.
14. Service worker cache strategy matches performance budget.
15. New frontend passes all golden visual comparisons.

## Rollback
- Flip feature flag to disable new frontend; legacy serves content immediately.
- Clear CDN cache for frontend assets if stale content persists.
- If critical bug found, roll back deployment and revert git commit.
