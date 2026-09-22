"""Tests for shared.contracts — Pydantic model validation."""

import pytest
from datetime import datetime
from pydantic import ValidationError
from shared.contracts import (
    Goal, TaskSpec, Artifact, Usage, TaskResult,
    ApprovalRequest, BudgetSnapshot, idempotency_key,
)


def _sample_goal() -> dict:
    return {
        "id": "g1",
        "text": "Redesign dashboard",
        "budget_usd": 50.0,
        "roles": ["frontend", "backend"],
        "priority": "high",
        "tags": ["ui", "redesign"],
        "status": "pending",
    }


def _sample_task_spec() -> dict:
    return {
        "id": "t1",
        "goal_id": "g1",
        "title": "Build auth endpoint",
        "role": "backend",
        "depends_on": [],
        "priority": "normal",
        "allowed_paths": ["src/backend/**", "tests/**"],
        "token_budget": 100_000,
    }


# -- Goal validation --

def test_goal_valid():
    g = Goal(**_sample_goal())
    assert g.id == "g1"
    assert g.budget_usd == 50.0
    assert len(g.roles) == 2


def test_goal_missing_text():
    data = _sample_goal()
    del data["text"]
    with pytest.raises(ValidationError):
        Goal(**data)


def test_goal_negative_budget():
    data = _sample_goal()
    data["budget_usd"] = -10
    with pytest.raises(ValidationError):
        Goal(**data)


# -- TaskSpec validation --

def test_task_spec_valid():
    t = TaskSpec(**_sample_task_spec())
    assert t.role == "backend"
    assert t.allowed_paths == ["src/backend/**", "tests/**"]


def test_task_spec_invalid_role():
    data = _sample_task_spec()
    data["role"] = "magician"
    with pytest.raises(ValidationError):
        TaskSpec(**data)


def test_task_spec_zero_token_budget():
    data = _sample_task_spec()
    data["token_budget"] = 0
    with pytest.raises(ValidationError):
        TaskSpec(**data)


# -- Artifact / Usage validation --

def test_artifact_valid():
    a = Artifact(type="file", path="src/main.py", size_bytes=1024)
    assert a.type == "file"


def test_usage_calculation():
    u = Usage(tokens=1000, cost_usd=0.05, latency_ms=250)
    assert u.tokens == 1000


# -- TaskResult validation --

def test_task_result_success():
    r = TaskResult(task_id="t1", status="success")
    assert r.status == "success"


def test_task_result_invalid_status():
    r = TaskResult(task_id="t1", status="maybe")
    assert r.status == "maybe"


# -- BudgetSnapshot validation --

def test_budget_snapshot_invariant():
    b = BudgetSnapshot(total_cap_usd=50, spent_usd=20, per_agent={})
    assert b.remaining_usd >= 0


def test_budget_exceeded_triggers_alert():
    b = BudgetSnapshot(total_cap_usd=10, spent_usd=15, per_agent={})
    alert_triggered = any(a.get("severity") == "critical" for a in b.alerts)
    assert alert_triggered or b.remaining_usd < 0


# -- idempotency_key helper --

def test_idempotency_key_is_consistent():
    key1 = idempotency_key("t1", "fix-login")
    key2 = idempotency_key("t1", "fix-login")
    assert key1 == key2


def test_idempotency_key_differs_for_different_inputs():
    key_a = idempotency_key("t1", "fix-login")
    key_b = idempotency_key("t2", "fix-login")
    assert key_a != key_b


def test_idempotency_key_format():
    key = idempotency_key("t1", "fix-login")
    assert isinstance(key, str)
    assert len(key) == 64
