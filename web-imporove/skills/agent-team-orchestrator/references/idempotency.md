# Idempotency — Preventing Duplicate Tasks

When a client retries a goal submission or a network hiccup causes a message
to be delivered twice to the dispatcher, the orchestrator must not create two
identical tasks with separate lifecycles. Idempotency deduplication lives in
`orchestrator/idempotency.py` and relies on a composite key of `task_id` +
`idempotency_key`.

---

## How It Works

The `check_or_create(task_id, idempotency_key, spec)` function:

1. Queries the `TaskSpec` table for a row where
   `task_id = $1 AND idempotency_key = $2`.
2. If found, returns the existing `TaskSpec` instance without creating a new one.
3. If not found, inserts the `TaskSpec` record and returns it.

The database enforces a unique constraint on `(task_id, idempotency_key)`,
so even if two requests arrive simultaneously, only one insert succeeds;
the other gets an IntegrityError that translates to a return-of-existing-record.

---

## Why It Matters

Without deduplication:

- Two identical tasks spawn two independent agent runs, doubling LLM token consumption.
- Both runs produce their own draft PR branch, causing merge conflicts on the next squash.
- Budget tracking becomes inaccurate because usage counts multiply.
- The DAG executor processes duplicates as if they were distinct dependencies,
  potentially unblocking downstream tasks prematurely.

---

## Idempotency Key Format

The queen planner generates the key deterministically from the task content:

```
sha256(f"{role}:{title}")[:16]
```

This means that identical planning calls (same role, same task title) always
produce the same key. Different titles or roles get different keys. If a client
re-submits an entire goal that yields the same task list, the dispatcher
recognizes duplicates and skips re-dispatching those tasks.

---

## State Machine Transitions

Tasks follow this lifecycle regardless of duplicate detection:

```
PENDING → APPROVED → DISPATCHED → RUNNING → COMPLETED
                      │         → FAILED
                      ↓
                   BLOCKED (waiting on parent)
```

Idempotent deduplication only applies while a task is in `PENDING` or
`APPROVED` status. Once dispatched, a second arrival is treated as a normal
duplicate and the existing running/failed record is returned.
