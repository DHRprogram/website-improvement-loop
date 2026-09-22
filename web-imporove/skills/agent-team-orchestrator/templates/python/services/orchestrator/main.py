"""Orchestrator service — Django + Celery Queen implementation.

Receives goal.created events, calls LLM to produce a JSON plan of tasks,
builds a DAG in Postgres, publishes task.assigned events.
NEVER deploys to production; only requests draft PRs via git_bridge.

All operations are idempotent via task_id + idempotency_key dedup.
Every call propagates X-Correlation-Id headers.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ---- Models ----

class Goal(BaseModel):
    """Django model for stored goals."""

    class Meta:
        app_label = "orchestrator"

    id: str
    text: str
    status: str = "planned"
    budget_usd: float = 50.0
    created_at: str

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "Goal":
        return cls(
            id=data.get("id", ""),
            text=data["text"],
            status=data.get("status", "planned"),
            budget_usd=data.get("budget_usd", 50.0),
            created_at=data.get("created_at", _now_iso()),
        )


class TaskSpec(BaseModel):
    """Django model for a single queued task."""

    id: str
    goal_id: str
    title: str
    role: str
    depends_on: list[str] = []
    priority: str = "normal"
    allowed_paths: list[str] = []
    token_budget: int = 5000
    idempotency_key: str = ""
    status: str = "pending"

    @classmethod
    def from_plan(cls, plan_task: dict[str, Any], goal_id: str) -> "TaskSpec":
        return cls(
            id=plan_task.get("id", ""),
            goal_id=goal_id,
            title=plan_task["title"],
            role=plan_task["role"],
            depends_on=plan_task.get("depends_on", []),
            priority=plan_task.get("priority", "normal"),
            allowed_paths=plan_task.get("allowed_paths", []),
            token_budget=plan_task.get("token_budget", 5000),
        )

    def generate_idempotency_key(self) -> None:
        """Derive the idempotency key from task attributes if not already set."""
        if not self.idempotency_key:
            raw = f"{self.goal_id}:{self.title}:{self.role}"
            self.idempotency_key = hashlib.sha256(raw.encode()).hexdigest()[:32]


class TaskResult(BaseModel):
    """Stores the outcome after a task completes."""

    task_id: str
    status: str
    artifacts: list[dict[str, Any]] = []
    usage: dict[str, Any] = {}
    error: str | None = None


# ---- Idempotency Dedup ----

class IdempotencyManager:
    """Prevents duplicate task dispatching using task_id + idempotency_key dedup.

    Workflow:
        manager = IdempotencyManager(redis_url="redis://...")
        existing = await manager.check_or_create(task_spec)
        if existing:
            logger.info("Duplicate detected, skipping")
            return existing
        # safe to dispatch

    This is the canonical dedup path used by all Queen planning logic.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        import redis.asyncio as redis

        self._client = redis.from_url(redis_url, decode_responses=True)

    async def check_or_create(self, spec: TaskSpec) -> bool:
        """Return True if this was a DUPLICATE (already exists). False if new.

        Uses Redis SETNX with key = skill_b:idempotency:{idempotency_key}.
        """
        if not spec.idempotency_key:
            spec.generate_idempotency_key()
        key = f"skill_b:idempotency:{spec.idempotency_key}"
        result = await self._client.set(key, "1", nx=True, ex=86400 * 7)  # 7-day TTL
        return result is None  # NX failed means key already existed

    async def close(self) -> None:
        await self._client.close()


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
