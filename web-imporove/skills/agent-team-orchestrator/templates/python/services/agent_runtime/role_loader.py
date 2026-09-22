"""Role prompt loader — fetches prompts for each agent role."""

from shared.role_prompts import ROLE_PROMPTS, VALID_ROLES
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class RoleLoader:
    """Load and validate role configurations for agents."""

    @staticmethod
    def get_role_prompt(role: str) -> dict:
        if role not in VALID_ROLES:
            raise ValueError(f"Invalid role: {role}. Valid: {VALID_ROLES}")
        config = ROLE_PROMPTS[role]
        return {
            "system_prompt": config["prompt"],
            "allowed_paths": config.get("allowed_paths", []),
            "constraints": config.get("constraints", []),
            "max_tokens": config.get("max_tokens", 100_000),
        }

    @staticmethod
    async def load_role_for_task(task_id: str, role: str) -> dict:
        prompt_config = RoleLoader.get_role_prompt(role)
        context = await _fetch_memory_context(task_id)
        full_prompt = f"{prompt_config['system_prompt']}\n\nAdditional context:\n{context}"
        return {**prompt_config, "system_prompt": full_prompt}


async def _fetch_memory_context(task_id: str) -> str:
    from .memory_retriever import MemoryRetriever
    retriever = MemoryRetriever()
    docs = await retriever.search(f"task:{task_id}", k=3)
    return "\n".join(d.get("text", "")[:500] for d in docs)
