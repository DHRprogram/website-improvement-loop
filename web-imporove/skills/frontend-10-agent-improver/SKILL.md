---
name: frontend-10-agent-improver
description: >-
  A fully automated 10-agent system that improves ONLY the frontend of a
  website. Covers component architecture, performance, accessibility,
  design system, responsive, UX states, forms, motion, frontend SEO/meta,
  and frontend tests. Runs audit -> merge -> rank -> fix top 3-5 -> verify ->
  revert if worse -> log, with measurable before/after metrics, a strict
  no-backend guardrail, and no human intervention. Invoked via
  /web-improvement-loop:improve (this skill is the Phase A engine of the
  web-improvement-loop family; the full autonomous redesign is the separate
  frontend-master-loop skill behind /web-improvement-loop:frontend). Use when asked to improve the frontend,
  audit the UI, run autonomous frontend improvements, or fix the frontend
  automatically.
---

# Frontend 10-Agent Improver

## Architecture

The system uses 11 agents organized as a supervisor-worker topology:

- **A0 Orchestrator**: leads the loop, ranks findings, manages git, decides revert
- **A1 Component Architecture Agent**: component structure, coupling, reusability
- **A2 Performance Agent**: Core Web Vitals, bundle size, lazy loading
- **A3 Accessibility Agent**: WCAG 2.2 AA compliance, axe-core rules
- **A4 Design System Agent**: token consistency, design-system adherence
- **A5 Responsive & Mobile Agent**: mobile breakpoints, touch targets
- **A6 UX States & Flow Agent**: loading, empty, error, edge-case states
- **A7 Forms & Validation Agent**: form UX, validation patterns, error messages
- **A8 Motion & Micro-interaction Agent**: animation performance, reduced-motion
- **A9 Frontend SEO & Metadata Agent**: meta tags, structured data, heading hierarchy
- **A10 Frontend Testing Agent**: test coverage, component tests, a11y tests
- **Verifier**: runs verify-change.sh after each fix

## Iron Rules

1. Frontend ONLY. Never touch /server, /api, /backend, /db, /migrations, /prisma, /models, *.sql, schema.*, migrate.*
2. Every change must be revertible with a single git revert.
3. Every commit has before/after metric measurement.
4. Never commit secrets. Guard runs on every commit.
5. Never modify package.json without asking.
6. Never force push, never rebase main, never amend pushed commits.
7. If a fix makes a metric worse, revert immediately.
8. Max 5 findings per iteration. One finding per commit.

## Execution Loop (11 Steps)

1. **Audit**: Run all selected agents (A1..A10) to collect findings.
2. **Merge**: Deduplicate findings by agent+title_normalized+first_file.
3. **Rank**: priority = severity_weight x impact / effort.
4. **Select**: Take top 3-5 findings from ranked queue.
5. **Fix**: For each finding, apply fix_sketch and commit.
6. **Verify**: Run verify-change.sh on each commit.
7. **Revert if worse**: If verify-change.sh exits 2 (metric regressed), git revert HEAD.
8. **Log**: Append to RUN_LOG.md with full details.
9. **Re-measure**: Run measure-frontend.sh to update metrics.
10. **Check stop conditions**: 100 iterations, no P2+ findings, 5 iterations without >1% improvement.
11. **Repeat**: If not stopped, go to step 1.

## Frontend Rubric (9 Dimensions, total 100)

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Visual Correctness & Render | 15 | Pixel-perfect rendering, no layout shifts |
| Performance (CWV) | 20 | LCP < 2.5s, INP < 200ms, CLS < 0.1 |
| Accessibility | 15 | WCAG 2.2 AA, axe-core zero violations |
| Design System Compliance | 10 | Token usage, component library adherence |
| Responsive & Mobile | 10 | Works on all breakpoints, touch targets 48px |
| UX States & Flow | 10 | Loading, empty, error, disabled states |
| Forms & Validation | 5 | Validation UX, error messaging, keyboard nav |
| Motion & Micro-interaction | 5 | Intentional motion, prefers-reduced-motion |
| Frontend SEO & Metadata | 5 | Meta tags, structured data, semantic HTML |
| Frontend Testing | 5 | Component tests, a11y tests, coverage |

## Severity Map (Severity Weight)

| Severity | Weight | Definition | Example |
|----------|--------|------------|---------|
| P0 | 1000 | Blocking: app broken, data loss, crash | White screen on route, form submits silently fail |
| P1 | 300 | Critical: major UX broken, accessibility blocker | Keyboard trapped in modal, LCP > 8s |
| P2 | 100 | Major: noticeable issue, degrades UX | Missing alt text, layout shift on load |
| P3 | 30 | Minor: cosmetic, nice-to-have, enhancement | Non-standard focus ring, unused CSS variable |

## Stop Conditions

1. Reached max-iterations (default 100, hard cap 500).
2. No open findings with severity >= min-severity (default P2).
3. 5 consecutive iterations with no improvement >1% on any metric.

## Non-Goals (Never Touched)

- Backend code (server, API, DB, auth, infra, DevOps)
- Database schema, migrations, SQL
- API contract changes
- Authentication servers, middleware
- Deployment, CI/CD pipelines
- Infrastructure as code
- Third-party service integration backends
- Data models, ORM schemas
