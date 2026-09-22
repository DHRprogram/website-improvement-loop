"""Track per-task token usage and cost for budget enforcement."""

import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

BUDGET_CAP_USD = float(os.environ.get("BUDGET_CAP_USD", "50.00"))
PER_AGENT_CAP = float(os.environ.get("PER_AGENT_BUDGET_USD", "10.00"))


class UsageTracker:
    """Accumulate token counts and USD costs across tasks."""

    def __init__(self):
        self.total_spent_usd: float = 0.0
        self.agent_spending: dict[str, float] = {}
        self.task_token_counts: dict[str, int] = {}

    def record_usage(self, model: str, tokens: int, cost_usd: float):
        self.total_spent_usd += cost_usd
        self.agent_spending[model] = self.agent_spending.get(model, 0.0) + cost_usd
        logger.info("Usage tracked: model=%s tokens=%d cost=$%.4f total=$%.2f",
                     model, tokens, cost_usd, self.total_spent_usd)

    def check_budget_limit(self) -> tuple[bool, str]:
        if self.total_spent_usd > BUDGET_CAP_USD:
            msg = f"Budget cap exceeded: ${self.total_spent_usd:.2f}/${BUDGET_CAP_USD:.2f}"
            logger.error(msg)
            return False, msg
        return True, ""

    def check_agent_limit(self, model: str) -> tuple[bool, str]:
        agent_cost = self.agent_spending.get(model, 0.0)
        if agent_cost > PER_AGENT_CAP:
            msg = f"Per-agent cap exceeded for {model}: ${agent_cost:.2f}/${PER_AGENT_CAP:.2f}"
            logger.error(msg)
            return False, msg
        return True, ""
