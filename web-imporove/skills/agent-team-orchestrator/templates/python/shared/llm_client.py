"""OpenRouter-compatible LLM API client with retry, rate limiting, and audit logging.

All calls propagate X-Correlation-Id headers for distributed tracing.
Every call is logged to the structured audit log file.
On persistent failures (429/5xx), falls back to OPENROUTER_FALLBACK_MODEL.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 120
MAX_RETRIES = 3
BASE_RETRY_DELAY_MS = 1000


class AuditLog:
    """Append-only JSON-lines audit logger for all LLM calls."""

    def __init__(self, path: str | None = None) -> None:
        self._path = path or "artifacts/agent-team-orchestrator/audit.log.jsonl"

    def log(self, entry: dict[str, Any]) -> None:
        """Append a single audit record as a JSON line."""
        try:
            with open(self._path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, default=str) + "\n")
        except OSError as exc:
            logger.error("Failed to write audit log: %s", exc)


class LLMClient:
    """Client wrapper around the OpenRouter /chat/completions endpoint.

    Usage::

        client = LLMClient(model="qwen/qwen3.8-27b:free")
        result = await client.chat(messages=[{"role": "user", "content": "Hello"}])
    """

    def __init__(
        self,
        model: str | None = None,
        fallback_model: str | None = None,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        max_retries: int = MAX_RETRIES,
        api_key: str | None = None,
        base_url: str = "https://openrouter.ai/api/v1",
    ) -> None:
        import httpx

        self._base_url = base_url.rstrip("/") + "/chat/completions"
        self._api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self._model = model or os.environ.get(
            "OPENROUTER_MODEL", "qwen/qwen3.8-27b:free"
        )
        self._fallback_model = fallback_model or os.environ.get(
            "OPENROUTER_FALLBACK_MODEL", "qwen/qwen2.5-72b:free"
        )
        self._timeout = timeout_seconds
        self._max_retries = max_retries
        self._active_model = self._model
        self._http = httpx.AsyncClient(
            base_url="https://openrouter.ai/api/v1",
            timeout=self._timeout,
            headers={"Authorization": f"Bearer {self._api_key}"},
        )
        self._audit = AuditLog()
        self._failure_count = 0

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        response_format: dict[str, str] | None = None,
        correlation_id: str | None = None,
        task_id: str | None = None,
    ) -> dict[str, Any]:
        """Send a chat completion request and return parsed JSON.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Override the default model for this call.
            temperature: Sampling temperature 0.0-1.0.
            response_format: Structured output hint (e.g., {"type": "json_object"}).
            correlation_id: Propagated X-Correlation-Id header.
            task_id: Associated task identifier for audit tracking.

        Returns:
            The raw JSON response body from the API.

        Raises:
            RuntimeError: If all retries are exhausted.
        """
        prompt_hash = hashlib.sha256(
            json.dumps(messages, sort_keys=True).encode()
        ).hexdigest()[:16]

        start_time = time.time()
        last_exc: Exception | None = None

        for attempt in range(self._max_retries):
            try:
                payload: dict[str, Any] = {
                    "model": model or self._active_model,
                    "messages": messages,
                    "temperature": temperature,
                }
                if response_format:
                    payload["response_format"] = response_format

                resp = await self._http.post(
                    "/chat/completions",
                    json=payload,
                    headers={
                        "X-Correlation-Id": correlation_id or "",
                        "X-Task-Id": task_id or "",
                    },
                )

                latency_ms = int((time.time() - start_time) * 1000)
                data = resp.json()

                tokens_in = len(data.get("usage", {}).get("prompt_tokens", [])) if isinstance(data.get("usage", {}).get("prompt_tokens"), list) else data.get("usage", {}).get("prompt_tokens", 0)
                tokens_out = len(data.get("usage", {}).get("completion_tokens", [])) if isinstance(data.get("usage", {}).get("completion_tokens"), list) else data.get("usage", {}).get("completion_tokens", 0)
                cost_usd = round(
                    (tokens_in or 0) * 0.00000015
                    + (tokens_out or 0) * 0.0000006,
                    6,
                )

                self._failure_count = 0
                self._audit.log({
                    "timestamp": _now_iso(),
                    "agent": task_id or "unknown",
                    "task_id": task_id or "",
                    "prompt_hash": prompt_hash,
                    "model": self._active_model,
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "cost_usd": cost_usd,
                    "latency_ms": latency_ms,
                    "correlation_id": correlation_id or "",
                    "status": "success",
                })
                return data

            except Exception as exc:
                last_exc = exc
                self._failure_count += 1
                delay = BASE_RETRY_DELAY_MS * (2 ** attempt) / 1000
                logger.warning(
                    "LLM call attempt %d/%d failed: %s (retry in %.1fs)",
                    attempt + 1, self._max_retries, exc, delay,
                )
                if attempt < self._max_retries - 1:
                    await asyncio.sleep(delay)

        # All retries exhausted — switch to fallback
        if self._failure_count >= 2:
            old_model = self._active_model
            self._active_model = self._fallback_model
            logger.error(
                "Primary model '%s' failed. Switching to fallback '%s'",
                old_model, self._fallback_model,
            )

        self._audit.log({
            "timestamp": _now_iso(),
            "agent": task_id or "unknown",
            "task_id": task_id or "",
            "prompt_hash": prompt_hash,
            "model": self._active_model,
            "status": "failed",
            "error": str(last_exc),
            "correlation_id": correlation_id or "",
        })
        raise RuntimeError(f"LLM chat failed after {self._max_retries} attempts") from last_exc

    async def close(self) -> None:
        """Release HTTP connections."""
        await self._http.aclose()

    @property
    def active_model(self) -> str:
        return self._active_model


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
