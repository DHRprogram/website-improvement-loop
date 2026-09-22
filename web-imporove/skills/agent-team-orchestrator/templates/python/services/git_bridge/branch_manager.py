"""Git branch naming and lifecycle management."""

import uuid
import re
from datetime import datetime


def generate_branch_name(prefix: str = "skill-b", goal_title: str = "") -> str:
    clean = re.sub(r"[^a-z0-9]", "-", goal_title.lower()[:40])
    return f"{prefix}/{clean}-{str(uuid.uuid4())[:8]}"


class BranchManager:
    """Track branch state across tasks."""

    def __init__(self):
        self.branches: dict[str, str] = {}  # task_id -> branch_name

    def register_branch(self, goal_id: str, branch_name: str) -> None:
        self.branches[goal_id] = branch_name

    def get_branch(self, goal_id: str) -> str | None:
        return self.branches.get(goal_id)
