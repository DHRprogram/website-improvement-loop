"""Pydantic contract models for the Agent Team Orchestrator platform.

All services import from this module to ensure consistent data schemas.
Models enforce required fields, types, and validation rules defined
by the Queen planning prompt specification.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class Goal(BaseModel):
    """A high-level goal submitted by a human operator."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str = Field(..., min_length=1, description="Natural language goal description")
    roles: list[str] = Field(default_factory=list, description="Requested agent role names")
    budget_usd: float = Field(default=50.0, ge=0, description="Maximum cost in USD")
    priority: str = Field(default="normal", pattern="^(low|normal|high|critical)$")
    tags: list[str] = Field(default_factory=list)
    status: str = Field(default="planned", pattern="^(planned|planning|dispatched|running|reviewing|approved|rejected|cancelled)$")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Goal text must not be blank")
        return v


class TaskSpec(BaseModel):
    """A single decomposed task produced by the Queen planner."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    goal_id: str = Field(..., description="Parent goal identifier")
    title: str = Field(..., min_length=1, max_length=512)
    description: str = Field(..., min_length=1, max_length=4096)
    role: str = Field(..., pattern="^(designer|frontend|backend|qa|security|devops|reviewer)$")
    depends_on: list[str] = Field(default_factory=list)
    priority: str = Field(default="normal", pattern="^(low|normal|high|critical)$")
    allowed_paths: list[str] = Field(
        default_factory=list,
        description="Glob patterns specifying which files this agent may modify"
    )
    token_budget: int = Field(default=5000, gt=0, description="Max tokens for LLM call")
    idempotency_key: str = Field(default="", description="Prevents duplicate dispatch")

    @field_validator("idempotency_key")
    @classmethod
    def generate_idempotency_key(cls, v: str, info) -> str:
        if not v:
            obj_values = info.data
            tid = obj_values.get("id", "")
            ts = obj_values.get("_created_at", "")
            v = hashlib.sha256(f"{tid}:{ts}".encode()).hexdigest()[:32]
        return v

    class Config:
        populate_by_name = True


class Artifact(BaseModel):
    """A file or report produced by an agent during task execution."""

    type: str = Field(..., description="File category: code, test, config, report")
    path: str = Field(..., min_length=1)
    size_bytes: int = Field(ge=0)


class Usage(BaseModel):
    """Token and cost tracking for a single LLM invocation."""

    tokens_in: int = Field(default=0, ge=0)
    tokens_out: int = Field(default=0, ge=0)
    cost_usd: float = Field(default=0.0, ge=0.0)
    latency_ms: int = Field(default=0, ge=0)

    @property
    def total_tokens(self) -> int:
        return self.tokens_in + self.tokens_out


class TaskResult(BaseModel):
    """Outcome of a dispatched task including artifacts and usage stats."""

    task_id: str = Field(...)
    status: str = Field(pattern="^(success|failed|partial)$")
    artifacts: list[Artifact] = Field(default_factory=list)
    usage: Usage = Field(default_factory=Usage)
    error: str | None = Field(default=None)
    sandbox_exit_code: int | None = Field(default=None)
    completed_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class ApprovalRequest(BaseModel):
    """A request sent to a human operator for task approval before merge."""

    task_id: str = Field(...)
    approver_id: str = Field(default="human-operator")
    action: str = Field(pattern="^(approve|reject|request_changes)$")
    notes: str = Field(default="")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class BudgetSnapshot(BaseModel):
    """Point-in-time view of budget consumption across all agents."""

    version: str = Field(default="1.0.0")
    total_cap_usd: float = Field(gt=0)
    spent_usd: float = Field(ge=0)
    remaining_usd: float = Field(ge=0)
    per_agent: dict[str, dict[str, Any]] = Field(default_factory=dict)
    alerts: list[dict[str, Any]] = Field(default_factory=list)
    hard_stop_triggered: bool = Field(default=False)
    overrides: list[dict[str, Any]] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    @field_validator("remaining_usd")
    @classmethod
    def validate_remaining(cls, v: float, info) -> float:
        cap = info.data.get("total_cap_usd", 0)
        spent = info.data.get("spent_usd", 0)
        expected = max(0, cap - spent)
        if abs(v - expected) > 0.01:
            raise ValueError(f"remaining_usd {v} should equal cap {cap} - spent {spent}")
        return v
