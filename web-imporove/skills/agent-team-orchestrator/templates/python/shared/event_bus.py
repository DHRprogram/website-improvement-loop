"""Redis Streams event bus for inter-service communication.

Provides publish/subscribe/ack patterns using Redis Streams.
Each topic supports multiple consumer groups for fan-out delivery.

Topics:
    goal.created, task.created, task.assigned, task.completed,
    task.failed, review.requested, approval.needed, artifact.created, budget.exceeded
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)

VALID_TOPICS = frozenset([
    "goal.created",
    "task.created",
    "task.assigned",
    "task.completed",
    "task.failed",
    "review.requested",
    "approval.needed",
    "artifact.created",
    "budget.exceeded",
])


class EventBus:
    """Async Redis Streams pub/sub client with message acknowledgment."""

    def __init__(self, url: str = "redis://localhost:6379/0") -> None:
        self._client: redis.Redis = redis.from_url(url, decode_responses=True)
        self._subscribers: dict[str, list] = {}

    async def connect(self) -> None:
        """Establish connection to Redis."""
        await self._client.ping()
        logger.info("EventBus connected to Redis")

    async def disconnect(self) -> None:
        """Close all connections and subscriptions."""
        for group_subs in self._subscribers.values():
            for sub in group_subs:
                try:
                    await sub.aclose()
                except Exception:
                    pass
        await self._client.close()
        logger.info("EventBus disconnected")

    async def publish(self, topic: str, payload: dict[str, Any]) -> str:
        """Publish a message to a topic. Returns the message ID.

        Args:
            topic: One of the VALID_TOPICS constants.
            payload: Arbitrary JSON-serializable data.

        Returns:
            The Redis stream entry ID (e.g., '1234567890-0').

        Raises:
            ValueError: If topic is not valid.
        """
        if topic not in VALID_TOPICS:
            raise ValueError(
                f"Invalid topic '{topic}'. Valid: {sorted(VALID_TOPICS)}"
            )
        message_id = str(uuid.uuid4())
        data = {
            "message_id": message_id,
            "topic": topic,
            "payload": json.dumps(payload),
            "timestamp": _now_iso(),
        }
        stream_key = f"skill_b:stream:{topic}"
        await self._client.xadd(stream_key, data)
        return message_id

    async def subscribe(
        self,
        topic: str,
        group_name: str,
        consumer_name: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Subscribe to a topic. Yields decoded payloads until the generator is closed.

        After processing each message the caller should call ack().

        Args:
            topic: Topic to subscribe to.
            group_name: Consumer group name.
            consumer_name: Optional consumer identifier.

        Yields:
            Decoded payload dict from each message.

        Raises:
            ValueError: If topic is not valid.
        """
        if topic not in VALID_TOPICS:
            raise ValueError(
                f"Invalid topic '{topic}'. Valid: {sorted(VALID_TOPICS)}"
            )
        if consumer_name is None:
            consumer_name = f"consumer-{uuid.uuid4().hex[:8]}"

        stream_key = f"skill_b:stream:{topic}"
        try:
            await self._client.xgroup_create(
                stream_key, group_name, id="0", mkstream=True
            )
        except redis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

        while True:
            entries = await self._client.xreadgroup(
                group_name,
                consumer_name,
                {stream_key: ">"},
                count=10,
                block=1000,
            )
            if not entries:
                continue
            for _, stream_entries in entries:
                for msg_id_raw, fields in stream_entries:
                    payload_data = json.loads(fields.get("payload", "{}"))
                    yield payload_data
                    await self._ack(topic, group_name, msg_id_raw)

    async def ack(self, topic: str, group_name: str, message_id: str) -> bool:
        """Acknowledge a processed message.

        Args:
            topic: The topic the message was published to.
            group_name: Consumer group that processed the message.
            message_id: The Redis stream entry ID.

        Returns:
            True if the ack succeeded.
        """
        stream_key = f"skill_b:stream:{topic}"
        try:
            result = await self._client.xack(stream_key, group_name, message_id)
            return result > 0
        except Exception as exc:
            logger.warning(f"Ack failed for {message_id}: {exc}")
            return False

    async def _ack(self, topic: str, group_name: str, message_id: str) -> None:
        """Internal non-failing ack."""
        try:
            await self._client.xack(
                f"skill_b:stream:{topic}", group_name, message_id
            )
        except Exception:
            pass

    async def stream_length(self, topic: str) -> int:
        """Return the number of entries in the topic's stream."""
        stream_key = f"skill_b:stream:{topic}"
        info = await self._client.xinfo_stream(stream_key)
        return int(info.get("length", 0))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
