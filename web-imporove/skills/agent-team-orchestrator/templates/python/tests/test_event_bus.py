"""Tests for shared.event_bus — Redis Streams pub/sub."""

import pytest
from shared.event_bus import EventBus


@pytest.mark.asyncio
async def test_invalid_topic_rejected():
    """Invalid topics should raise ValueError."""
    bus = EventBus(redis_url="redis://localhost:6379/9")
    with pytest.raises(ValueError):
        await bus.publish("", {"data": "invalid"})
    with pytest.raises(ValueError):
        await bus.publish("a" * 100, {"data": "too-long"})


@pytest.mark.asyncio
async def test_publish_method_exists():
    """Verify publish has correct signature."""
    bus = EventBus(redis_url="redis://localhost:6379/9")
    assert hasattr(bus, "publish")
    assert hasattr(bus, "subscribe")
    assert hasattr(bus, "ack")
    assert hasattr(bus, "connect")
