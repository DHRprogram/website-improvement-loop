"""Standalone idempotency dedup module — also used by agent_runtime."""

import hashlib
import logging
from typing import Optional
from shared.event_bus import EventBus
import os

logger = logging.getLogger(__name__)


class IdempotencyDedup:
    """Redis-backed SETNX dedup with 7-day TTL to prevent duplicate dispatch."""

    def __init__(self, event_bus: EventBus):
        self.bus = event_bus

    def derive_key(self, goal_id: str, title: str, role: str) -> str:
        raw = f"{goal_id}:{title}:{role}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    async def try_claim(self, key: str) -> bool:
        """Return True if this task was claimed (first caller wins)."""
        full_key = f"skill_b:idempotency:{key}"
        pipe = await self.bus._redis.pipeline()
        claimed = await pipe.set(full_key, "1", nx=True, ex=604800).execute()
        acquired = claimed[0] == 1
        if not acquired:
            logger.warning("Duplicate dispatch blocked for key=%s", key)
        return acquired

    async def release(self, key: str):
        full_key = f"skill_b:idempotency:{key}"
        await self.bus._redis.delete(full_key)
