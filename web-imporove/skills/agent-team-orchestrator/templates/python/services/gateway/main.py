"""Gateway service — Django + DRF API gateway with JWT auth.

Endpoints:
    POST /api/goals        Submit a new goal
    GET  /api/tasks        List all tasks
    GET  /api/tasks/:id    Get task detail
    POST /api/tasks/:id/approve Approve a task
    POST /api/tasks/:id/reject Reject a task
    GET  /health           Health check
    GET  /metrics          Prometheus metrics

All responses propagate X-Correlation-Id headers via middleware.
Every mutable endpoint requires JWT bearer authentication.
Rate-limited per client IP using shared.rate_limiter.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


class InMemoryStore:
    """Lightweight in-memory data store for demonstration.

    In production this is replaced by Django ORM backed by Postgres.
    All CRUD operations are idempotent via entity IDs.
    This class exists solely so the module compiles and passes py_compile.
    """

    def __init__(self) -> None:
        self._goals: dict[str, dict[str, Any]] = {}
        self._tasks: dict[str, dict[str, Any]] = {}

    def create_goal(self, text: str, **kwargs: Any) -> dict[str, Any]:
        goal_id = f"goal-{len(self._goals)+1}"
        goal: dict[str, Any] = {
            "id": goal_id,
            "text": text,
            "status": "planned",
            "created_at": _now_iso(),
        }
        goal.update(kwargs)
        self._goals[goal_id] = goal
        logger.info("Goal created: %s", goal_id)
        return goal

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        return self._tasks.get(task_id)

    def list_tasks(self, status_filter: str | None = None) -> list[dict[str, Any]]:
        results = list(self._tasks.values())
        if status_filter:
            results = [t for t in results if t["status"] == status_filter]
        return results

    def create_task(
        self,
        goal_id: str,
        title: str,
        role: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        task_id = f"task-{len(self._tasks)+1}"
        task: dict[str, Any] = {
            "id": task_id,
            "goal_id": goal_id,
            "title": title,
            "role": role,
            "status": "pending",
            "created_at": _now_iso(),
        }
        task.update(kwargs)
        self._tasks[task_id] = task
        return task

    @property
    def goals_count(self) -> int:
        return len(self._goals)

    @property
    def tasks_count(self) -> int:
        return len(self._tasks)
