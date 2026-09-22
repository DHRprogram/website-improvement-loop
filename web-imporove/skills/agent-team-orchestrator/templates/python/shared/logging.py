"""Structured JSON logger for all platform services.

Every log record includes correlation_id, task_id, and agent_id fields
for distributed tracing across services. Uses python-json-logger when
available, falling back to a simple format otherwise.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import traceback
from datetime import datetime, timezone
from typing import Any

LEVEL_MAP = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "WARN": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


class JSONFormatter(logging.Formatter):
    """Format every log record as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        extra: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", ""),
            "task_id": getattr(record, "task_id", ""),
            "agent_id": getattr(record, "agent_id", ""),
        }
        if record.exc_info and record.exc_info[0] is not None:
            extra["exception"] = "".join(
                traceback.format_exception(*record.exc_info)
            ).strip()
        return json.dumps(extra, default=str)


def get_logger(
    name: str,
    level_str: str | None = None,
) -> logging.Logger:
    """Return a configured logger instance.

    Args:
        name: Logger name (typically __name__).
        level_str: Optional level string like 'INFO'. Defaults to INFO_ENV or DEBUG.

    Returns:
        Configured logging.Logger ready for use.
    """
    level = LEVEL_MAP.get((level_str or os.environ.get("LOG_LEVEL", "INFO")).upper(), logging.INFO)
    logger = logging.getLogger(name)
    if logger.handlers:
        # Already configured — just set level
        logger.setLevel(level)
        return logger

    logger.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    handler.setLevel(level)
    logger.addHandler(handler)
    # Avoid duplicate handlers on repeated calls
    logger.propagate = False
    return logger


def add_correlation_context(
    correlation_id: str,
    task_id: str | None = None,
    agent_id: str | None = None,
) -> dict[str, Any]:
    """Return a context dict suitable for loggers that accept contextvars.

    This helper makes it easy to attach trace metadata to every log call
    within a request scope.

    Args:
        correlation_id: UUID from the X-Correlation-Id header.
        task_id: Associated task identifier.
        agent_id: The agent performing the action.

    Returns:
        Dict with keys correlation_id, task_id, agent_id for injection.
    """
    return {
        "correlation_id": correlation_id,
        "task_id": task_id or "",
        "agent_id": agent_id or "",
    }
