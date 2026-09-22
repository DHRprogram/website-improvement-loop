# Rate Limiting — Reference Guide

## Algorithm: Redis Sorted-Set Sliding Window

Each process group maintains a sliding window of allowed requests using a Redis sorted set. The score is the Unix timestamp with millisecond precision.

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `RATE_LIMIT_REQUESTS` | 20 | Max requests per window |
| `RATE_LIMIT_WINDOW_SECONDS` | 60 | Sliding window size |

### How It Works

On each request:

1. Remove entries outside the window (`zremrangebyscore` from `0` to `now - window`).
2. Count current entries in window (`zcard`).
3. If count >= limit, return HTTP 429 with `Retry-After`.
4. Otherwise, add this request entry and expire key after `window + 1s`.

### Behavior on 429

When the client receives HTTP 429:

1. Never drop the request — it will be retried.
2. Apply exponential backoff: `base_delay * 2^attempt`, capped at 30 seconds.
3. Queue the request for deferred processing.
4. After receiving the next successful response, clear the queue entry.
5. If consecutive failures persist beyond 10 retries, switch to the fallback model defined by `OPENROUTER_FALLBACK_MODEL`.

### Fallback Model Switching

```python
if persistent_failure_count >= MAX_FAILURES:
    active_model = os.environ.get("OPENROUTER_FALLBACK_MODEL", "qwen/qwen2.5-72b:free")
    logger.warning(f"Switched to fallback model due to persistent failures")
```

### Per-Process Group Isolation

Each service instance has its own Redis key namespace:

```
skill_b:rll:{service_name}:{process_group_id}:{timestamp_ms}
```

This ensures that replicas do not share a single counter unnecessarily, each service can have its own limits if needed, and process groups within a service still respect individual budgets.
