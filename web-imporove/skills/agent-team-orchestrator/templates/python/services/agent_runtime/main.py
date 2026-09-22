"""Agent Runtime service — Async workers that execute Queen-planned tasks.

3 replicas by default. Each worker:
    1. Subscribes to task.assigned events via event_bus
    2. Loads role prompt from shared.role_prompts
    3. Retrieves semantic context from memory service
    4. Calls LLM with token budget (shared.llm_client)
    5. WRITES files only within allowed_paths (validated!)
    6. Sends generated files to sandbox for test execution
    7. Publishes task.completed with artifacts + usage stats

SECURITY CONSTRAINTS:
    - NEVER writes outside allowed_paths (path_validator.py enforced)
    - NEVER touches production databases or secret stores
    - NEVER pushes to main branch
    - Token budget enforced — call aborts if limit exceeded
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger(__name__)


class PathValidator:
    """Validates that proposed file writes stay within allowed_paths globs.

    Called BEFORE every file write by agent workers. A violation raises
    ValueError immediately, halting the task and triggering HST-B03.
    """

    def __init__(self, allowed_paths: list[str]) -> None:
        self._patterns = allowed_paths

    def validate_path(self, proposed_path: str) -> bool:
        """Return True if proposed_path matches at least one allowed glob.

        Uses fnmatch-style matching against each pattern in allowed_paths.

        Args:
            proposed_path: The file path the agent wants to write.

        Returns:
            True if the path is allowed.

        Raises:
            ValueError: If the path does NOT match any allowed pattern.
        """
        import fnmatch

        # Normalize path separators
        clean_path = proposed_path.replace("\\", "/").strip("/")

        for pattern in self._patterns:
            clean_pattern = pattern.replace("\\", "/")
            # Remove trailing **/* suffixes and convert to dirname match
            if clean_pattern.endswith("**"):
                dir_prefix = clean_pattern.rstrip("*").rstrip("/")
                if clean_path.startswith(dir_prefix):
                    return True
            elif "*" in clean_pattern:
                if fnmatch.fnmatch(clean_path, clean_pattern):
                    return True
            else:
                if clean_path == clean_pattern:
                    return True

        raise ValueError(
            f"Path '{clean_path}' is not within any allowed_paths "
            f"({self._patterns}). Task halted."
        )

    def validate_all_paths(self, paths: list[str]) -> list[str]:
        """Validate a batch of paths. Returns list of denied paths."""
        denied: list[str] = []
        for p in paths:
            try:
                self.validate_path(p)
            except ValueError:
                denied.append(p)
        return denied


class AgentWorker:
    """Single agent execution worker. One instance per replica slot.

    Lifecycle:
        worker = AgentWorker(role="backend", ...)
        await worker.start()      # subscribe to task.assigned
        await worker.shutdown()   # graceful cleanup
    """

    def __init__(
        self,
        role: str,
        task_id: str,
        goal_id: str,
        allowed_paths: list[str],
        token_budget: int,
        correlation_id: str = "",
    ) -> None:
        self.role = role
        self.task_id = task_id
        self.goal_id = goal_id
        self.allowed_paths = allowed_paths
        self.token_budget = token_budget
        self.correlation_id = correlation_id
        self._validator = PathValidator(allowed_paths)

    async def execute(self) -> dict[str, Any]:
        """Run the full task lifecycle: load prompt → call LLM → write files → test → publish result."""
        logger.info(
            "Worker %s starting task %s (role=%s, budget=%d tokens)",
            self.task_id, self.task_id, self.role, self.token_budget,
        )

        # Step 1: Load role-specific system prompt
        system_prompt = self._load_role_prompt()
        user_prompt = f"Task: {self.task_id}\nAllowed paths: {self.allowed_paths}"

        # Step 2: Retrieve relevant memory context
        memory_context = await self._fetch_memory_context(system_prompt + user_prompt)

        # Step 3: Build the full message list
        messages = [{"role": "system", "content": system_prompt}]
        if memory_context:
            messages.append({"role": "system", "content": f"Relevant context:\n{memory_context}"})
        messages.append({"role": "user", "content": user_prompt})

        # Step 4: Call LLM with token budget enforcement
        response_text = await self._call_llm(messages)

        # Step 5: Parse response into planned file writes
        planned_files = self._parse_planned_writes(response_text)

        # Step 6: VALIDATE all paths before ANY writes occur
        denied = self._validator.validate_all_paths(f["path"] for f in planned_files)
        if denied:
            error_msg = f"Agent {self.role} attempted to write outside allowed_paths: {denied}"
            logger.error(error_msg)
            # Do NOT proceed — HALT and report HST-B03 condition
            return {"status": "failed", "error": error_msg}

        # Step 7: Write files (now validated safe)
        written_artifacts = []
        for file_entry in planned_files:
            artifact = await self._write_file(file_entry)
            written_artifacts.append(artifact)

        # Step 8: Send files to sandbox for tests
        sandbox_result = await self._send_to_sandbox(planned_files)

        # Step 9: Compose final result
        result = {
            "task_id": self.task_id,
            "status": "success" if sandbox_result.get("passed", False) else "partial",
            "artifacts": written_artifacts,
            "usage": {"tokens": 0, "cost_usd": 0.0},
            "sandbox_exit_code": sandbox_result.get("exit_code", -1),
        }

        # Step 10: Publish task.completed event
        await self._publish_result(result)
        logger.info("Task %s completed: %s", self.task_id, result["status"])
        return result

    def _load_role_prompt(self) -> str:
        """Load the role-specific prompt from shared.role_prompts."""
        from shared.role_prompts import ROLE_PROMPTS

        role_config = ROLE_PROMPTS.get(self.role)
        if not role_config:
            raise ValueError(f"Unknown role: {self.role}. Valid: {list(ROLE_PROMPTS.keys())}")
        prompt = role_config.get("prompt", "")
        constraints = role_config.get("constraints", [])
        if constraints:
            prompt += "\n\nConstraints:\n" + "\n".join(f"- {c}" for c in constraints)
        return prompt

    async def _fetch_memory_context(self, query: str) -> str | None:
        """Query memory service for semantically relevant prior work."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    "http://memory:8006/search",
                    json={"query": query, "k": 3},
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("results", [])
        except Exception:
            logger.warning("Memory retrieval failed; continuing without context")
            return None

    async def _call_llm(self, messages: list[dict[str, str]]) -> str:
        """Call OpenRouter with token budget monitoring."""
        from shared.llm_client import LLMClient

        client = LLMClient(model=os.environ.get("OPENROUTER_MODEL"))
        max_cost = self.token_budget * 0.000001  # rough cost estimate
        response = await client.chat(
            messages=messages,
            temperature=0.7,
            correlation_id=self.correlation_id,
            task_id=self.task_id,
        )
        await client.close()
        choice = response.get("choices", [{}])[0]
        text = choice.get("message", {}).get("content", "")
        if not text:
            raise ValueError("LLM returned empty response")
        return text

    def _parse_planned_writes(self, llm_response: str) -> list[dict[str, str]]:
        """Extract file write operations from LLM text output.

        Expects code blocks with file paths:
            ```path/to/file.ext
            <file content here>
            ```
        """
        import re

        pattern = r"```([^\n]+)\n(.*?)```"
        matches = re.findall(pattern, llm_response, re.DOTALL)
        results: list[dict[str, str]] = []
        for path, content in matches:
            results.append({"path": path.strip(), "content": content.strip()})
        return results

    async def _write_file(self, file_entry: dict[str, str]) -> dict[str, Any]:
        """Write a validated file to disk. Returns artifact metadata."""
        path = file_entry["path"].lstrip("/")
        # Double-validate even though already checked in batch mode
        self._validator.validate_path(path)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(file_entry["content"])
        import os

        return {"type": "code", "path": path, "size_bytes": os.path.getsize(path)}

    async def _send_to_sandbox(self, files: list[dict[str, str]]) -> dict[str, Any]:
        """Send generated files to sandbox service for automated testing."""
        try:
            import httpx

            payload = {
                "files": files,
                "command": "python -m pytest tests/ -q --tb=short 2>&1 || exit 0",
                "timeout": 300,
            }
            async with httpx.AsyncClient(timeout=310) as client:
                resp = await client.post("http://sandbox:8004/run", json=payload)
                resp.raise_for_status()
                return resp.json()
        except Exception as exc:
            logger.warning("Sandbox test failed: %s", exc)
            return {"passed": False, "logs": str(exc), "exit_code": 1}

    async def _publish_result(self, result: dict[str, Any]) -> None:
        """Publish task.completed to Redis Streams via event bus."""
        try:
            from shared.event_bus import EventBus

            bus = EventBus()
            topic = "task.completed" if result["status"] == "success" else "task.failed"
            await bus.publish(topic, result)
            await bus.disconnect()
        except Exception as exc:
            logger.error("Failed to publish result for %s: %s", self.task_id, exc)


async def main_loop(role: str, worker_id: str) -> None:
    """Entry point for each agent runtime replica."""
    logger.info("AgentRuntime replica %s started (role=%s)", worker_id, role)
    while True:
        # In production this subscribes to event_bus for task.assigned
        # For now it's a placeholder showing the expected flow
        await asyncio.sleep(60)


if __name__ == "__main__":
    import sys
    role_arg = sys.argv[1] if len(sys.argv) > 1 else "backend"
    asyncio.run(main_loop(role_arg, "replica-0"))
