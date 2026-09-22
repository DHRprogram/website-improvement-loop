# Queen Orchestrator Prompt Guide

The Queen (agent role `queen-orchestrator`) is the first agent activated after a
goal is submitted. Its job: convert a free-text goal into a structured, ordered
plan of tasks that the DAG executor can schedule.

---

## Planning Prompt Structure

The system prompt stored in `orchestrator/prompts.QUEEN_PLANNING_PROMPT`:

```
You are the Queen Orchestrator for an autonomous AI engineering team.
Given a human-written goal, decompose it into individual executable tasks.

For each task, produce:
- title: Short descriptive name (≤ 80 characters)
- description: Detailed steps the assigned agent should follow
- role: One of [designer, frontend, backend, qa, security, devops, reviewer]
- depends_on: Array of titles of tasks that must finish first (empty [] if none)
- priority: One of [low, normal, high, critical]
- allowed_paths: Glob patterns for files this agent may edit (e.g. ["src/components/**/*.tsx"])
- token_budget: Maximum tokens for LLM calls during this task (e.g. 8000)

Rules:
1. Every non-trivial goal needs at least a backend + frontend + qa triplet.
2. Dependency graphs must be acyclic; you will not accept circular dependencies.
3. Allowed paths must be scoped — do not grant wildcard access to the whole repo.
4. Token budgets default to 5000; increase to 10000+ only for complex refactors.
5. Include a reviewer task near the end that inspects all artifact diffs.
6. If the goal is small enough for one agent, still include a reviewer task.

Output ONLY valid JSON — no markdown fences, no explanatory text:
{"tasks": [...]}
```

---

## Expected JSON Output Schema

```json
{
  "tasks": [
    {
      "title": "Create REST endpoints for users",
      "description": "Write Django models, serializers, and views...",
      "role": "backend",
      "depends_on": [],
      "priority": "critical",
      "allowed_paths": ["apps/users/models.py", "apps/users/views.py", "apps/users/serializers.py"],
      "token_budget": 6000
    },
    {
      "title": "Build user form component",
      "description": "React form with email/password fields...",
      "role": "frontend",
      "depends_on": ["Create REST endpoints for users"],
      "priority": "high",
      "allowed_paths": ["src/components/UserForm.tsx"],
      "token_budget": 4000
    }
  ]
}
```

---

## Role Selection Rules

The Queen picks roles based on the nature of each sub-task:

| Task Type | Default Role |
|-----------|-------------|
| Database models / migrations / API endpoints | backend |
| UI components, pages, styling | frontend |
| Layout mockups, color palette, token definitions | designer |
| Regression tests, contract validation | qa |
| Secret scanning, dependency audit | security |
| Docker compose updates, CI pipeline config | devops |
| Reviewing diffs and approving/rejecting | reviewer |

---

## Token Budget Management

The Queen's own token budget for generating the plan is bounded by
`OPENROUTER_MAX_TOKENS_PER_CALL` (default 8000). If the goal is sufficiently
complex that a single planning call cannot produce a good plan, the Queen
should break the goal into sub-goals and issue multiple planning requests,
collecting partial plans before assembling the full DAG.

Budget failures (Queen itself hits rate limits or context overflow) trigger an
immediate `budget.exceeded` event and activate hard stops until a human reviews.
