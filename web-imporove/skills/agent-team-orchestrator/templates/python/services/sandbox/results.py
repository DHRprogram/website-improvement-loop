"""Sandbox result aggregation and validation."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SandboxResult:
    exit_code: int
    passed: bool
    logs: str
    duration_ms: float
    artifacts: list[str] = field(default_factory=list)
    error: str = ""

    @classmethod
    def success(cls, logs: str, exit_code: int = 0) -> "SandboxResult":
        return cls(exit_code=exit_code, passed=True, logs=logs, duration_ms=0)

    @classmethod
    def failure(cls, logs: str, error: str = "") -> "SandboxResult":
        return cls(exit_code=-1, passed=False, logs=logs, duration_ms=0, error=error)

    @classmethod
    def timeout(cls, logs: str = "") -> "SandboxResult":
        return cls(exit_code=-2, passed=False, logs=logs, duration_ms=60000,
                   error="Sandbox execution timed out after 60 seconds")
