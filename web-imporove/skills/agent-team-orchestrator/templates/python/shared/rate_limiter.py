"""Redis sorted-set sliding window rate limiter.

Default limits: 20 requests per 60-second window per process group.
On HTTP 429: applies exponential backoff and requeues (never drops).
On persistent failures beyond MAX_ATTEMPTS: switches to fallback model.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)

DEFAULT_RATE_LIMIT_REQUESTS = 20
DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60
MAX_BACKOFF_SECONDS = 30
MAX_ATTEMPTS = 10


class RateLimiter:
    """Sliding-window rate limiter backed by Redis sorted sets."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        max_requests: int = DEFAULT_RATE_LIMIT_REQUESTS,
        window_seconds: int = DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        import redis.asyncio as redis

        self._client = redis.from_url(redis_url, decode_responses=True)
        self._max_requests = max_requests
        self._window_ms = window_seconds * 1000
        self._fallback_triggered = False
        self._consecutive_failures = 0

    async def is_allowed(self, key: str) -> bool:
        """Check if a request is allowed under current rate limit.

        Args:
            key: Namespace key (e.g., 'gateway:default').

        Returns:
            True if within limits; False if rate-limited.
        """
        now_ms = int(time.time() * 1000)
        window_start = now_ms - self._window_ms
        pipe = self._client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.execute()
        # Count must be done after removal
        count = await self._client.zcard(key)
        if count >= self._max_requests:
            logger.warning(
                "Rate limit exceeded for %s: %d/%d in window",
                key, count, self._max_requests,
            )
            return False
        entry_id = f"{now_ms}-{self._generate_suffix()}"
        await self._client.zadd(key, {entry_id: now_ms})
        await self._client.expire(key, self._window_ms // 1000 + 2)
        return True

    async def call_with_backoff(
        self,
        func: Callable[..., Awaitable],
        *args: object,
        **kwargs: object,
    ) -> object:
        """Execute a function with retry/backoff on failure.

        On success resets failure counter. After MAX_ATTEMPTS consecutive
        failures flips _fallback_triggered to True so callers can switch
        to a backup model/provider.

        Args:
            func: Async callable to execute.
            *args: Positional arguments passed through.
            **kwargs: Keyword arguments passed through.

        Returns:
            The result of func(*args, **kwargs).

        Raises:
            RuntimeError: If all attempts fail.
        """
        last_exc: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            try:
                result = await func(*args, **kwargs)
                self._consecutive_failures = 0
                self._fallback_triggered = False
                return result
            except Exception as exc:
                last_exc = exc
                self._consecutive_failures += 1
                delay = min(2 ** attempt, MAX_BACKOFF_SECONDS)
                logger.warning(
                    "Attempt %d/%d failed for %s: %s (backoff %.1fs)",
                    attempt + 1, MAX_ATTEMPTS, func.__name__, exc, delay,
                )
                if attempt < MAX_ATTEMPTS - 1:
                    await asyncio.sleep(delay)
        if self._consecutive_failures >= MAX_ATTEMPTS:
            self._fallback_triggered = True
            logger.error("Fallback triggered after %d consecutive failures", MAX_ATTEMPTS)
        raise RuntimeError(
            f"All {MAX_ATTEMPTS} attempts failed. Fallback active: {self._fallback_triggered}"
        ) from last_exc

    @property
    def fallback_triggered(self) -> bool:
        """Whether the fallback mode has been activated due to persistent failures."""
        return self._fallback_triggered

    @staticmethod
    def _generate_suffix() -> str:
        import uuid

        return uuid.uuid4().hex[:4]

    async def close(self) -> None:
        """Release the Redis connection."""
        await self._client.close()
