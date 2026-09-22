"""Celery tasks for Queen planning and orchestration."""

from celery import shared_task
from orchestrator.models import Goal, TaskSpec
import json, logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, acks_late=True)
def queen_plan_goal(self, goal_id: str) -> str:
    """Run the Queen planner to decompose a goal into a task DAG."""
    try:
        goal = Goal.objects.get(id=goal_id)
    except Goal.DoesNotExist:
        logger.error("Goal %s not found for planning", goal_id)
        return "ERROR"

    from services.agent_runtime.main import AgentWorker
    worker = AgentWorker.__new__(AgentWorker)

    system_prompt = _load_queen_system_prompt()
    user_message = f"Plan tasks for this goal:\n{goal.text}"

    result = worker._call_llm(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
    )

    plan = json.loads(result["content"])
    tasks = plan.get("tasks", [])

    saved = []
    for t in tasks:
        spec = TaskSpec.objects.create(
            goal=goal,
            title=t.get("title", ""),
            description=t.get("description", ""),
            role=t.get("role"),
            depends_on=json.dumps(t.get("depends_on", [])),
            priority=t.get("priority", "normal"),
            allowed_paths=json.dumps(t.get("allowed_paths", [])),
            token_budget=t.get("token_budget", 100_000),
        )
        saved.append(spec.id)

    goal.status = "planned"
    goal.save()
    return json.dumps(saved)


def _load_queen_system_prompt():
    from pathlib import Path
    p = Path(__file__).parent / "prompts.py"
    if p.exists():
        from orchestrator.prompts import QUEEN_SYSTEM_PROMPT
        return QUEEN_SYSTEM_PROMPT
    return "You are a technical project manager. Decompose goals into tasks."
