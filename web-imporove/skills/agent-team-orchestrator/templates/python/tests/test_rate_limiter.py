"""Tests for shared.rate_limiter — Sliding window rate limiter."""

import pytest
from shared.rate_limiter import RateLimiter


@pytest.mark.asyncio
async def test_constructor_defaults():
    limiter = RateLimiter()
    assert limiter.max_requests == 20
    assert limiter.window_seconds == 60
    assert limiter.namespace == "default"


@pytest.mark.asyncio
async def test_per_process_group_isolation(mock_redis):
    """Different process groups should have separate counts."""
    bus = await mock_redis.get_event_bus()
    limiter_a = RateLimiter(
        redis_url="redis://localhost:6379/9", max_requests=5, window_seconds=60,
        namespace="test-a",
    )
    limiter_b = RateLimiter(
        redis_url="redis://localhost:6379/9", max_requests=5, window_seconds=60,
        namespace="test-b",
    )
    for i in range(5):
        allowed, _ = await limiter_a.check_limit("proc-1")
        assert allowed is True
    # test-a at limit
    allowed_a, _ = await limiter_a.check_limit("proc-2")
    # test-b still under limit
    allowed_b, _ = await limiter_b.check_limit("proc-2")
    assert allowed_a is False
    assert allowed_b is True
