# Frontend Rubric

Total: 100 points across 10 dimensions.

| # | Dimension | Weight | Excellent (90-100%) | Good (70-89%) | Needs Work (<70%) |
|---|-----------|--------|---------------------|---------------|-------------------|
| 1 | Visual Correctness & Render | 15 | Pixel-perfect, no layout shifts, proper spacing | Minor alignment issues, <3 CLS issues | Broken layout, overflow, missing elements |
| 2 | Performance (CWV) | 20 | LCP < 1.5s, INP < 100ms, CLS < 0.05 | LCP < 2.5s, INP < 200ms, CLS < 0.1 | LCP > 4s, INP > 300ms, CLS > 0.25 |
| 3 | Accessibility | 15 | WCAG 2.2 AA, axe 0 violations, keyboard nav | Axe < 5 violations, good heading structure | Axe > 10 violations, missing alt text |
| 4 | Design System Compliance | 10 | 100% token usage, consistent components | Mostly tokens, <5 hardcoded values | Many hardcoded colors/spacing |
| 5 | Responsive & Mobile | 10 | All breakpoints perfect, touch targets 48px+ | Works on major breakpoints, minor overflow | Broken on mobile, touch target violations |
| 6 | UX States & Flow | 10 | All states handled, smooth transitions | Loading/empty states present, errors basic | Missing loading/empty/error states |
| 7 | Forms & Validation | 5 | Inline validation, clear errors, keyboard nav | Submit validation works, decent error msgs | No client validation, broken tab order |
| 8 | Motion & Micro-interaction | 5 | Purposeful motion, reduced-motion supported | Basic transitions, some reduced-motion | Missing transitions, no reduced-motion |
| 9 | Frontend SEO & Metadata | 5 | Complete meta, JSON-LD, semantic HTML | Basic meta tags present, some semantics missing | Missing title/description/no OG tags |
| 10 | Frontend Testing | 5 | >80% coverage, a11y tests, behavior tests | >50% coverage, component tests exist | No tests or snapshot-only |

## Scoring

Score each dimension 0 to weight value. Sum to get total score (0-100).

### Visual Correctness (0-15)
- DOM structure matches visual hierarchy
- Zero unexpected layout shifts
- Consistent spacing within components
- No overflow or content clipping
- Correct font rendering across browsers

### Performance (0-20)
- LCP measured on 3 key routes
- Bundle size under reasonable thresholds
- No render-blocking resources
- Images optimized and lazy-loaded
- Code-splitting applied at route level

### Accessibility (0-15)
- Semantic HTML elements used
- ARIA attributes correct and complete
- Keyboard navigation works end-to-end
- Color contrast meets WCAG 2.2 AA
- Focus management for interactive widgets

### Design System (0-10)
- CSS custom properties used for colors, spacing, typography
- Component library API respected
- Theme consistency (light/dark)
- No duplicated styling patterns

### Responsive (0-10)
- Mobile-first CSS approach
- All content accessible at 320px width
- Touch targets minimum 48x48 CSS pixels
- Print stylesheet or print-friendly

### UX States (0-10)
- Loading skeletons for async content
- Empty states for zero-data views
- Error boundaries with recovery actions
- Disabled states for inactive controls

### Forms (0-5)
- Client-side validation with inline messaging
- Autocomplete attributes on common fields
- Keyboard tab order matches visual order
- Accessible error association

### Motion (0-5)
- Animations use transform/opacity only
- prefers-reduced-motion respected
- Animation durations under 500ms for functional
- Purposeful, not decorative

### SEO & Metadata (0-5)
- Unique title for each page
- Meta description for key pages
- Open Graph and Twitter Card tags
- JSON-LD structured data where applicable

### Testing (0-5)
- Component tests render and assert behavior
- A11y tests with axe for interactive components
- Integration tests for key user flows
- No snapshot-only tests
