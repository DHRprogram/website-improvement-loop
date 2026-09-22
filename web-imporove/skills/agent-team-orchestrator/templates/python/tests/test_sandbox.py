"""Tests for sandbox execution with mocked Docker API."""

import pytest
import asyncio


@pytest.fixture
def fake_container():
    class FakeContainer:
        id = "abc123"
        short_id = "abc123"
        attrs = {"Created": type('T', (), {"timestamp": lambda: __import__("time").time()})}
        status = "exited"

        def wait(self, timeout=None):
            return {"ExitCode": 0}

        def logs(self):
            return b"test output"

        def stop(self, timeout=5):
            pass

        def remove(self, force=True):
            pass
    return FakeContainer()


class FakeClient:
    def containers(self):
        return self

    def run(self, **kwargs):
        return {"id": "fake", "short_id": "fake"}

    def list(self, all=False):
        return []


@pytest.mark.asyncio
async def test_sandbox_result_success():
    from services.sandbox.results import SandboxResult
    result = SandboxResult.success(exit_code=0)
    assert result.passed is True
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_sandbox_result_failure():
    from services.sandbox.results import SandboxResult
    result = SandboxResult.failure(logs="boom", error="crash")
    assert result.passed is False
    assert result.error == "crash"


@pytest.mark.asyncio
async def test_sandbox_result_timeout():
    from services.sandbox.results import SandboxResult
    result = SandboxResult.timeout()
    assert result.passed is False
    assert result.exit_code == -2
    assert "timed out" in result.error


@pytest.mark.asyncio
async def test_cleanup_workspace(mock_docker_api):
    import tempfile, os
    from services.sandbox.cleanup import cleanup_workspace

    tmp = tempfile.mkdtemp()
    file_path = os.path.join(tmp, "test.txt")
    with open(file_path, "w") as f:
        f.write("temp data")
    cleanup_workspace(tmp)
    assert not os.path.exists(tmp)
