# Event Topics — Redis Streams Message Bus

All inter-service communication flows through a Redis Streams bus with nine
defined event topics. Every topic carries a JSON payload; consumers read via
`XREADGROUP`, acknowledge with `XACK`, and rely on the orchestrator's
idempotency layer to deduplicate re-deliveries.

---

## 1. goal.created

**Purpose:** Human or API submits a new project goal for the swarm to plan against.

| Field | Type | Description |
|-------|------|-------------|
| `goal_id` | string | UUIDv4 for the goal |
| `text` | string | Human-readable goal description |
| `roles` | string[] | Candidate roles that may be involved (e.g. `["frontend", "backend"]`) |

**Required fields:** `goal_id`, `text`  
**Example:**

```json
{
  "goal_id": "550e8400-e29b-41d4-a716-446655440000",
  "text": "Add user login page",
  "roles": ["frontend", "backend"]
}
```

---

## 2. task.created

**Purpose:** Queen orchestrator emits planned tasks derived from a goal.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUIDv4 for the task |
| `goal_id` | string | Parent goal this task belongs to |
| `spec` | object | Full TaskSpec: title, description, role, depends_on, priority, allowed_paths, token_budget, idempotency_key |

**Required fields:** `task_id`, `goal_id`, `spec`  
**Example:**

```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "goal_id": "550e8400-e29b-41d4-a716-446655440000",
  "spec": {
    "title": "Create auth view",
    "role": "frontend",
    "priority": "high",
    "allowed_paths": ["src/views/**/*.tsx"],
    "token_budget": 8000,
    "depends_on": [],
    "idempotency_key": "task-created-660e8400"
  }
}
```

---

## 3. task.assigned

**Purpose:** Dispatcher assigns an approved task to a specific agent worker.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUID of the task being assigned |
| `agent_id` | string | Worker identifier receiving the task |
| `role` | string | Role label matching the task spec |

**Required fields:** `task_id`, `agent_id`, `role`  
**Example:**

```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "agent_id": "agent-fe-01",
  "role": "frontend"
}
```

---

## 4. task.completed

**Purpose:** Worker signals successful completion of a task.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUID of the completed task |
| `agent_id` | string | Agent that finished the work |
| `result` | string | Summary of what was accomplished |
| `artifacts` | array[object] | List of produced artifacts (type, path, size) |
| `usage` | object | Tokens consumed, cost in USD, latency in ms |

**Required fields:** `task_id`, `agent_id`, `result`  
**Example:**

```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "agent_id": "agent-fe-01",
  "result": "Created LoginForm.tsx with email/password fields",
  "artifacts": [
    {"type": "source", "path": "src/views/LoginForm.tsx", "size": 2048}
  ],
  "usage": {
    "tokens": 4500,
    "cost_usd": 0.032,
    "latency_ms": 23000
  }
}
```

---

## 5. task.failed

**Purpose:** Worker reports a task could not complete.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUID of the failed task |
| `agent_id` | string | Agent that encountered the failure |
| `error` | string | Human-readable error description |
| `retry_count` | integer | Number of retries attempted so far |

**Required fields:** `task_id`, `agent_id`, `error`  
**Example:**

```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "agent_id": "agent-fe-01",
  "error": "Lint check failed: 3 TypeScript errors",
  "retry_count": 2
}
```

---

## 6. review.requested

**Purpose:** After task completion, a human reviewer is asked to inspect artifacts.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUID of the task under review |
| `reviewer_id` | string | Human approver identifier |
| `artifacts` | array[string] | Paths or URLs of files to review |

**Required fields:** `task_id`, `reviewer_id`  
**Example:**

```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "reviewer_id": "human-reviewer-alice",
  "artifacts": ["src/views/LoginForm.tsx"]
}
```

---

## 7. approval.needed

**Purpose:** A blocking decision requires explicit human sign-off before proceeding.

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUID of the blocked task |
| `approver_id` | string | Human responsible for the decision |
| `action` | string | What is needed: approve, reject, modify, escalate |
| `notes` | string | Context explaining the decision point |

**Required fields:** `task_id`, `approver_id`, `action`  
**Example:**

```json
{
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "approver_id": "human-lead-bob",
  "action": "approve",
  "notes": "Database migration requires manual confirmation"
}
```

---

## 8. artifact.created

**Purpose:** Any service emits when producing a durable artifact.

| Field | Type | Description |
|-------|------|-------------|
| `artifact_id` | string | UUID for the artifact |
| `task_id` | string | Parent task |
| `path` | string | Filesystem path or URL of the artifact |
| `type` | string | Category: source, test, config, report |

**Required fields:** `artifact_id`, `task_id`, `path`  
**Example:**

```json
{
  "artifact_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "task_id": "660e8400-e29b-41d4-a716-446655440001",
  "path": "src/views/LoginForm.tsx",
  "type": "source"
}
```

---

## 9. budget.exceeded

**Purpose:** Emitted when any agent exceeds its per-agent budget cap.

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Agent whose spend exceeded the limit |
| `current_spent` | number | Amount spent in USD so far |
| `cap` | number | Budget cap in USD for that agent |

**Required fields:** `agent_id`, `current_spent`, `cap`  
**Example:**

```json
{
  "agent_id": "agent-be-02",
  "current_spent": 21.50,
  "cap": 20.00
}
```

Triggering a hard stop (HST-B02 / HST-B06) immediately halts all agent runs.
