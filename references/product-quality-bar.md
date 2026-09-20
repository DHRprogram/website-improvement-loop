# Product Quality Bar

Every shipped idea must meet ALL of the following criteria. If any clause is unmet, the idea is NOT done.

## 1. UI/UX
- Visual design matches the existing design system (colours, spacing, typography, radius)
- Responsive: works on mobile (390px) and desktop (1440px)
- No visual regressions: compare screenshot before/after
- Follows platform conventions (links are `<a>`, buttons are `<button>`, etc.)

## 2. States
- **Loading**: Skeleton or spinner shown while async operation in flight
- **Empty**: Meaningful message when no data exists (not a blank page)
- **Error**: User-friendly error message with retry action
- **Success**: Confirmation feedback after mutation
- **Offline**: Graceful degradation when network unavailable
- **Slow**: Operation >1s gets a progress indicator

## 3. Accessibility
- Semantic HTML: landmarks, headings hierarchy, lists
- Keyboard: all interactive elements reachable and operable via Tab/Enter/Escape
- Focus visible: clear focus indicator on all interactive elements
- Labels: every form input has an associated `<label>` or `aria-label`
- Contrast: All text meets WCAG AA (4.5:1 normal, 3:1 large)
- ARIA: live regions for dynamic content, correct roles

## 4. Performance
- No new blocking JavaScript added to critical path
- Images are sized appropriately and lazy-loaded below fold
- No layout shift on initial load (CLS < 0.1)
- Measure LCP before and after — must not regress
- Bundle size impact tracked in metrics before/after

## 5. SEO
- New routes get unique `<title>`, `<meta name="description">`, and OG tags
- Semantic heading structure with one `<h1>` per page
- Canonical URL if applicable
- Structured data (JSON-LD) when appropriate

## 6. Security
- Server-side input validation for all form submissions
- Server-side authorisation check for every protected endpoint
- No secrets or credentials in client bundle
- CSRF protection for state-changing requests
- Rate limiting on sensitive endpoints

## 7. Analytics
- At least one analytics event tracking the success metric
- Event name documented in the codebase
- No PII sent to analytics provider

## 8. Tests
- Unit test for core business logic
- Integration test for the new API endpoint
- E2E/smoke test for the critical user flow
- Accessibility check on the new route

## 9. Docs
- Code comments for non-obvious logic
- Updated README if user-facing
- Updated IMPROVEMENT_LOG.md with what was built, why, and metric impact

## 10. Ship Discipline
- Single revertible commit per idea
- Commit message references idea ID and success metric
- PR description links to before/after metrics
- Post-build regression check passes (3 personas, axe, baseline-check)
