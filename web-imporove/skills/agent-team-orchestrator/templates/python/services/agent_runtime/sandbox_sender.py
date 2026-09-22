"""Sandbox sender — dispatches tasks to the isolated container service."""

import httpx
from typing import Any
import os
import logging

logger = logging.getLogger(__name__)


class SandboxSender:
    """Send task artifacts to the sandbox service for execution."""

    def __init__(self, sandbox_url: str | None = None):
        self.url = sandbox_url or os.environ.get(
            "SANDBOX_URL", "http://sandbox:8004/run"
        )
        self.timeout = float(os.environ.get("SANDBOX_DEFAULT_TIMEOUT", "60"))
        self._client: httpx.AsyncClient | None = None

    async def send(self, files: list[dict], test_code: str, task_id: str) -> dict:
        payload = {
            "files": files,
            "test_code": test_code,
            "task_id": task_id,
            "timeout_seconds": self.timeout,
        }
        logger.info("Sending task %s to sandbox at %s", task_id, self.url)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.url, json=payload)
            result = resp.json()
            if resp.status_code != 200:
                raise RuntimeError(f"Sandbox error: {result}")
            return result

    async def close(self):
        if self._client:
            await self._client.aclose()
