"""Pytest fixtures for the entire test suite.

Provides mocked versions of Redis, Docker API, and OpenRouter so that
unit tests run without any external dependencies or network access.
"""

from __future__ import annotations

import pytest


@pytest.fixture
def mock_redis(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Return a monkeypatch fixture pre-configured with in-memory Redis mocks."""
    class FakePipeline:
        def zremrangebyscore(self, *a: object, **k: object) -> "FakePipeline":
            return self

        def zcard(self, *a: object, **k: object) -> "FakePipeline":
            return self

        def execute(self) -> list[int]:
            return [0, 0]

    class FakeRedis:
        def __init__(self, *a: object, **k: object) -> None:  # noqa: ARG002
            self._data: dict[str, float] = {}

        def zremrangebyscore(self, key: str, *args: object) -> int:
            expired = [k for k, v in self._data.items() if v < 0]
            for k in expired:
                del self._data[k]
            return len(expired)

        def zcard(self, key: str) -> int:
            return len(self._data)

        def zadd(self, key: str, mapping: dict[str, float]) -> None:
            self._data.update(mapping)

        def expire(self, key: str, ttl: int) -> bool:
            return True

        def pipeline(self) -> FakePipeline:
            return FakePipeline()

        async def ping(self) -> bool:
            return True

        async def close(self) -> None:
            pass

    def fake_from_url(url: str, **kwargs: object) -> FakeRedis:  # noqa: ARG001
        return FakeRedis()

    import redis.asyncio as _redis

    monkeypatch.setattr(_redis, "from_url", fake_from_url)
    return monkeypatch


@pytest.fixture
def mock_docker_api(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Return a monkeypatch fixture pre-configured with a fake Docker API client.

    The fake returns deterministic results for container creation, execution,
    and cleanup — always successful unless the test injects an error path.
    """

    class FakeContainer:
        def __init__(self) -> None:
            self.id = "fake-container-001"
            self.attrs: dict[str, object] = {
                "NetworkSettings": {"IPAddress": "172.17.0.2"},
            }

        @property
        def logs(self) -> bytes:
            return b"All tests passed.\n"

    class FakeClient:
        def __init__(self, *a: object, **k: object) -> None:  # noqa: ARG002
            pass

        def run_container(
            self,
            image: str,  # noqa: ARG002
            command: str | list[str] | None = None,  # noqa: ARG002
            network_disabled: bool = False,  # noqa: ARG002
            read_only: bool = False,  # noqa: ARG002
            cap_drop: list[str] | None = None,  # noqa: ARG002
            mem_limit: int | str | None = None,  # noqa: ARG002
            tmpfs: dict[str, str] | None = None,  # noqa: ARG002
            remove: bool = False,  # noqa: ARG002
            stderr: bool = False,  # noqa: ARG002
            stdout: bool = True,  # noqa: ARG002
            *a: object,
            **k: object,
        ) -> FakeContainer:
            return FakeContainer()

        def prune(self, filters: dict[str, str]) -> dict[str, str]:
            return {"ContainersDeleted": []}

        def close(self) -> None:
            pass

    import docker

    monkeypatch.setattr(docker, "from_env", lambda *a, **k: FakeClient())
    return monkeypatch


@pytest.fixture
def mock_openrouter(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Return a monkeypatch fixture pre-configured with a fake OpenRouter response.

    All LLM calls within tests will receive this canned JSON response instead
    of hitting the real API. Useful for deterministic plan-parsing tests.
    """

    class FakeResponse:
        status_code = 200

        def json(self) -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"tasks":[{"title":"Test task","description":"A test","role":"backend","depends_on":[],"priority":"high","allowed_paths":["services/**/*.py"],"token_budget":5000}]}'
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 100, "completion_tokens": 50},
            }

        def raise_for_status(self) -> None:
            pass

    async def fake_post(*args: object, **kwargs: object) -> FakeResponse:  # noqa: ARG001
        return FakeResponse()

    import httpx

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return monkeypatch


@pytest.fixture
def sample_goal() -> dict[str, object]:
    """Return a valid goal dict matching the Queen plan schema."""
    return {
        "id": "goal-001",
        "text": "Build a login page with OAuth support",
        "roles": ["frontend", "backend"],
        "budget_usd": 25.0,
        "priority": "high",
    }


@pytest.fixture
def sample_task_spec() -> dict[str, object]:
    """Return a valid TaskSpec dict matching the Queen plan schema."""
    return {
        "id": "task-001",
        "goal_id": "goal-001",
        "title": "Implement login form component",
        "description": "Create React login form with email/password fields",
        "role": "frontend",
        "depends_on": [],
        "priority": "high",
        "allowed_paths": ["services/gateway/frontend/**/*.tsx"],
        "token_budget": 3000,
        "idempotency_key": "abc123",
    }
