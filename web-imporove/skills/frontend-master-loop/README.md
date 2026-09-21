# Frontend Master Loop

**Version:** 1.0.0
**License:** MIT

A fully autonomous frontend redesign loop for Claude Code. Operates in
strangler, greenfield, bluegreen, or design-system mode. Runs R0 through R10
without stopping — unless a Hard Stop Trigger fires.

## The Four Pillars

### 1. Approval Harvest (P0)
Before ANY work begins, the user answers EVERY question in a single form.
Scope, constraints, budgets, autonomy level, and risk acknowledgements are
collected once and locked. Never asked again unless scope changes.

### 2. Composition Registry (P1)
The skill scans the entire repository for reusable assets — skills, agents,
scripts, commands, workflows — and maps every phase (R0..R10) to the best
available asset. Reuse over reinvention.

### 3. Autonomous Execution Loop (AEL)
Phases execute sequentially without human intervention. After each phase, a
verifier runs. On PASS: continue. On FAIL: self-heal up to 3 attempts, then
Hard Stop. Never asks "continue?" between phases.

### 4. Hard Stop Triggers (HST)
Ten triggers that halt immediately, roll back, report, and wait for user input:
HST-01 (Golden Tests) through HST-10 (A11y gate).

## Phases

| Phase | Name | Guarded |
|-------|------|---------|
| P0 | Approval Harvest | No |
| P1 | Composition Registry | No |
| R0 | Preflight | Yes |
| R1 | Preservation | Yes |
| R2 | Spec Extraction | No |
| R3 | Data Contract Freeze | Yes |
| R4 | Golden Tests | Yes |
| R5 | Design System | Yes |
| R6 | Backend Rebuild | Yes |
| R7 | Frontend Rebuild | Yes |
| R8 | Strangler Migration | Yes |
| R8.5 | Parity Gates | Yes |
| R8.7 | Load + Chaos + Backup | Yes |
| R9 | Canary Cutover | Yes |
| R9.5 | Post-Cutover Monitor | Yes |
| R10 | Cleanup | Yes |

## Hard Stop Triggers

HST-01: Golden Test fails (3 attempts)
HST-02: SLO error budget > 25%
HST-03: Security high/critical vuln
HST-04: Data Contract drift
HST-05: Cost delta > approved
HST-06: Production DB touch
HST-07: Secret leak
HST-08: Backup restore > 10min
HST-09: Chaos drill SLO breach
HST-10: A11y critical violation

## Invocation

```
/web-improvement-loop:frontend --mode=strangler --routes=/dashboard,/profile
/web-improvement-loop:frontend --resume
/web-improvement-loop:frontend --dry-run
/web-improvement-loop:frontend --no-cutover
```

## Requirements

- Node.js >= 18
- Git repository
- Feature flag provider (or env-based flags)
- Staging database (for migration mode)
- APM/observability stack (recommended)
- Backup target (recommended)

## Installation

```bash
cp -r skills/frontend-master-loop ~/.claude/skills/
```

Then invoke with /web-improvement-loop:frontend.

## Safety

⚠️ This skill can autonomously modify your codebase. Always review
APPROVALS.json before granting autonomy. The skill NEVER touches production
databases, NEVER auto-runs migrations, and NEVER force pushes.
