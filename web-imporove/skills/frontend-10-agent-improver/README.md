# Frontend 10-Agent Improver

A fully automated 10-agent system that improves ONLY the frontend of a website.
Part of the web-improvement-loop namespaced slash command family.

## Quick Start

```bash
# In any frontend project:
/web-improvement-loop:frontend --max-iterations 50 --min-severity P2
```

## Architecture

```
A0 Orchestrator (loop, rank, git, revert)
├── A1 Component Architecture Agent
├── A2 Performance Agent (CWV, bundle)
├── A3 Accessibility Agent (WCAG 2.2 AA)
├── A4 Design System Agent
├── A5 Responsive & Mobile Agent
├── A6 UX States & Flow Agent
├── A7 Forms & Validation Agent
├── A8 Motion & Micro-interaction Agent
├── A9 Frontend SEO & Metadata Agent
└── A10 Frontend Testing Agent
```

## Loop

audit -> merge -> rank -> fix top 3-5 -> verify -> revert if worse -> log -> repeat

## Stop Conditions

- 100 iterations (configurable, hard cap 500)
- No findings with severity >= configured minimum
- 5 consecutive iterations without >1% improvement

## Guardrails

- Frontend ONLY: never touches backend, DB, API, auth, infra
- Revertible changes: one finding per commit, revert if metric regresses
- No secrets: automatic secret scanning on every commit

## Rubric (10 dimensions, 100 points total)

| Dimension | Weight |
|-----------|--------|
| Visual Correctness & Render | 15 |
| Performance (CWV) | 20 |
| Accessibility | 15 |
| Design System Compliance | 10 |
| Responsive & Mobile | 10 |
| UX States & Flow | 10 |
| Forms & Validation | 5 |
| Motion & Micro-interaction | 5 |
| Frontend SEO & Metadata | 5 |
| Frontend Testing | 5 |

## Installation

```bash
cp -r skills/frontend-10-agent-improver ~/.claude/skills/
```
Then invoke with `/web-improvement-loop:improve` (Phase A only).
For the full autonomous redesign use `/web-improvement-loop:frontend`
(skill: frontend-master-loop).

## Files

```
skills/frontend-10-agent-improver/
├── SKILL.md              # Main skill definition
├── README.md             # This file
├── LICENSE               # MIT
├── CHANGELOG.md          # Version history
├── .gitignore
├── package.json
├── .mcp.json
├── agents/               # 11 agent instruction files (A0-A10)
├── scripts/              # Run loop, merge, rank, measure, verify, guards
├── references/           # Rubric, severity guide, guardrails, report template
└── examples/             # Example finding, state, queue JSON files
```
