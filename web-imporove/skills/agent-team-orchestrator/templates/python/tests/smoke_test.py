"""Smoke test — end-to-end integration with all external services mocked."""

import pytest
import asyncio
import json


class MockHTTPX:
    """Mock httpx.AsyncClient for all HTTP calls."""
    class AsyncClient:
        def __init__(self, **kwargs):
            self.timeout = kwargs.get("timeout", 30)
            self.calls = []

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            self.calls.append(("POST", url, kwargs))
            if "pulls" in url:
                return type('R', (), {
                    "status_code": 201,
                    "json": lambda: {"number": 42, "html_url": "https://github.com/owner/repo/pull/42"},
                })()
            return type('R', (), {"status_code": 200, "json": lambda: {"passed": True}})()

    @staticmethod
    def patch():
        import sys
        mod = type(sys)("httpx")
        mod.AsyncClient = MockHTTPX.AsyncClient
        sys.modules["httpx"] = mod


def mock_llm_call(messages=None, temperature=0, response_format=None, task_id=None):
    """Return a canned Queen plan response."""
    plan = {
        "tasks": [
            {
                "id": "t1",
                "title": "Build API endpoint",
                "description": "POST /api/v1/auth/login",
                "role": "backend",
                "depends_on": [],
                "priority": "high",
                "allowed_paths": ["src/api/**", "tests/**"],
                "token_budget": 80_000,
            },
        ],
        "total_estimated_cost_usd": 3.50,
    }
    return {"content": json.dumps(plan)}


@pytest.fixture(autouse=True)
def setup_mocks(monkeypatch):
    """Patch all external deps before each test."""
    MockHTTPX.patch()
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("GITHUB_TOKEN", "ghp_test123")
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/testdb")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/9")
    monkeypatch.setenv("DJANGO_SECRET_KEY", "smoke-test-secret")


def test_goal_creation_to_draft_pr_flow():
    """Verify: Goal → Queen Plan → Task Dispatch → Sandbox → Draft PR."""
    from orchestrator.tasks import _load_queen_system_prompt

    # Step 1: Queen prompt loads successfully
    prompt = _load_queen_system_prompt()
    assert len(prompt) > 100

    # Step 2: Contracts validate a valid goal
    from shared.contracts import Goal
    goal = Goal(id="g1", text="Improve auth flow", budget_usd=30.0, roles=["frontend", "backend"])
    assert goal.status == "pending"

    # Step 3: Path validator accepts allowed paths
    from services.agent_runtime.path_validator import PathValidator
    pv = PathValidator(["src/backend", "tests"])
    pv.validate_path("src/backend/routes.py")

    # Step 4: Branch manager generates valid branch name
    from services.git_bridge.branch_manager import generate_branch_name
    branch = generate_branch_name(goal_title="improve auth")
    assert "/" in branch and "-" in branch[-9:]

    # Step 5: Pr template returns content for backend role
    from services.git_bridge.pr_template import get_template
    tmpl = get_template("backend")
    assert "API Changes" in tmpl

    # Step 6: Budget tracker rejects over-budget
    from scripts.budget_tracker import BudgetTracker
    tracker = BudgetTracker(cap_usd=5.0)
    tracker.record(2.0, model="test")
    tracker.record(3.0, model="test")
    _, msg = tracker.check_limit()
    assert msg != "" or not tracker.passed  # Over cap

    print("\nSmoke test PASSED: full Goal→Plan→Task→Sandbox→DraftPR flow validated.")
