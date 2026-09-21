# Severity Guide

## P0 — Blocking (Weight 1000)

App is broken, data loss occurs, or core functionality is completely unavailable.

| Agent | Example |
|-------|---------|
| A1 | Component fails to render due to missing export |
| A2 | App crashes on load due to bundle error |
| A3 | Form cannot be submitted via keyboard (blocker for assistive tech) |
| A4 | CSS variable resolves to undefined, breaking layout |
| A5 | Page renders blank on mobile |
| A6 | Data-fetching component shows infinite spinner |
| A7 | Form submits without validation, causing data corruption |
| A8 | Animation causes page to freeze |
| A9 | Missing canonical causes duplicate content indexation |
| A10 | Test suite fails to run |

## P1 — Critical (Weight 300)

Major UX broken, core accessibility blocker, significant performance issue.

| Agent | Example |
|-------|---------|
| A1 | Prop drilling through 5+ levels |
| A2 | LCP > 4s on main route |
| A3 | Keyboard focus trapped in modal |
| A4 | Hardcoded dark-mode colors break theme switching |
| A5 | Content overflows on tablet |
| A6 | Error state shows generic message with no retry |
| A7 | No inline validation, submit-only fails without feedback |
| A8 | Animation not respecting prefers-reduced-motion |
| A9 | No Open Graph tags on key pages |
| A10 | Critical component has zero tests |

## P2 — Major (Weight 100)

Noticeable issue that degrades UX but doesn't block functionality.

| Agent | Example |
|-------|---------|
| A1 | Component exceeds 250 lines |
| A2 | Lodash full barrel import adds 71 KB |
| A3 | Missing alt text on images |
| A4 | Hardcoded color instead of CSS variable |
| A5 | Touch target smaller than 48x48px |
| A6 | No empty state for list when data is empty |
| A7 | Email field missing autocomplete |
| A8 | Missing exit animation on dismissible element |
| A9 | Missing meta description on content page |
| A10 | Snapshot-only test with no behavior assertions |

## P3 — Minor (Weight 30)

Cosmetic issue, nice-to-have enhancement, code quality only.

| Agent | Example |
|-------|---------|
| A1 | Named export convention not followed |
| A2 | Minor unused CSS class |
| A3 | Non-unique id in DOM |
| A4 | Shadow hardcoded instead of token |
| A5 | Minor padding deviation on mobile |
| A6 | Toast duration slightly too short |
| A7 | Placeholder text not descriptive enough |
| A8 | Transition timing curve not deliberate |
| A9 | Title slightly over 60 chars |
| A10 | Test description not descriptive |
