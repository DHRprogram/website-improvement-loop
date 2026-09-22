"""Redis Streams event publisher for agent task lifecycle events."""

from shared.event_bus import EventBus
import json
import logging

logger = logging.getLogger(__name__)

TOPICS = {
    "TASK_STARTED": "agent:tasks:start",
    "TASK_COMPLETED": "agent:tasks:complete",
    "TASK_FAILED": "agent:tasks:fail",
    "APPROVAL_REQUESTED": "agent:approvals:request",
    "APPROVAL_GRANTED": "agent:approvals:grant",
}


class EventPublisher:
    """Publish agent lifecycle events to the Redis Streams event bus."""

    def __init__(self, event_bus: EventBus):
        self.bus = event_bus

    async def publish_task_started(self, task_id: str, role: str):
        await self.bus.publish(TOPICS["TASK_STARTED"], {
            "task_id": task_id, "role": role,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        })

    async def publish_task_completed(self, task_id: str, success: bool):
        await self.bus.publish(TOPICS["TASK_COMPLETED"], {
            "task_id": task_id, "success": success,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        })

    async def publish_approval_requested(self, approval_request: dict):
        await self.bus.publish(TOPICS["APPROVAL_REQUESTED"], approval_request)

    async def publish_task_failed(self, task_id: str, error: str):
        await self.bus.publish(TOPICS["TASK_FAILED"], {
            "task_id": task_id, "error": error,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
        })
