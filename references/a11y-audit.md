# Accessibility Audit — P12

## What P12 Covers
All rules tagged with: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice.

This includes:
- WCAG 2.0 Level A & AA
- WCAG 2.1 Level A & AA
- WCAG 2.2 Level AA
- Common best-practice rules from axe-core

## What P12 Does NOT Cover
- Screen reader-specific behaviour (reported by P03 in persona tests)
- Colour blindness beyond contrast (manual review)
- Cognitive load and plain language (manual review)
- Motion sensitivity (manual review — reported as note)

## Scope
Top 5 routes by internal link count × 3 modes: desktop (1440×900), mobile (390×844), zoom 200% (720×450).

## Rule Tags
```json
["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"]
```

## Impact → Severity Map
| axe Impact | Severity |
|------------|----------|
| critical | P0 |
| serious | P1 |
| moderate | P2 |
| minor | P3 |

## De-Duplicate Policy
Merge by (rule ID + impact). Each merged record:
- rule, impact, severity, help, helpUrl, wcag tags
- target (from first node's target array)
- sample_html (first node's HTML, max 200 chars)
- failure (first node's failureSummary)
- routes (Set of all routes where this occurs)
- modes (Set of all modes where this occurs)

## Exceptions
Manage in EXCEPTIONS.json:
```json
[
  {
    "rule": "color-contrast",
    "target": ".brand-header",
    "route": "/about",
    "reason": "Brand colour on non-text element",
    "expiry": "2026-12-31"
  }
]
```
Exceptions expire after 90 days. No exceptions for critical violations.

## Output
1. Raw: `axe/<route>-<mode>.json` (full axe results per run)
2. Summary: `axe/summary.json` (merged, deduplicated)
3. Report: `axe/P12_A11Y.md` (readable table)
4. Merge: Findings included in AGGREGATE.json by aggregate-findings.mjs
