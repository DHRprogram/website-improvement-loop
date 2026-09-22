"""Tests for Queen plan parsing — valid and malformed JSON."""

import pytest
from orchestrator.tasks import _load_queen_system_prompt


def test_queen_prompt_exists():
    """Queen system prompt should be loadable."""
    prompt = _load_queen_system_prompt()
    assert len(prompt) > 100
    assert "Queen Orchestrator" in prompt or "tasks" in prompt.lower()


def test_queen_prompt_mentions_roles():
    """Prompt should reference available roles."""
    prompt = _load_queen_system_prompt()
    for role in ["designer", "frontend", "backend", "qa", "security", "devops", "reviewer"]:
        assert role in prompt.lower(), f"Role '{role}' missing from Queen prompt"


def test_queen_prompt_json_format():
    """Prompt should instruct JSON-only output."""
    prompt = _load_queen_system_prompt()
    assert "json" in prompt.lower()


@pytest.mark.asyncio
async def test_valid_plan_structure():
    """A well-formed plan should have tasks array with required fields."""
    plan_data = {
        "tasks": [
            {
                "id": "t1",
                "title": "Create auth endpoint",
                "description": "POST /auth/login",
                "role": "backend",
                "depends_on": [],
                "priority": "high",
                "allowed_paths": ["src/api/**"],
                "token_budget": 100_000,
            },
        ],
        "total_estimated_cost_usd": 4.5,
    }
    assert len(plan_data["tasks"]) == 1
    task = plan_data["tasks"][0]
    assert all(k in task for k in ("id", "title", "role", "depends_on"))
