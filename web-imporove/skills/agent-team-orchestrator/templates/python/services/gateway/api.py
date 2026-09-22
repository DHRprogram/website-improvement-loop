"""Gateway API views — FastAPI endpoints for the public REST API."""

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import uuid, logging, os
from shared.contracts import Goal as ContractGoal, TaskSpec as ContractTaskSpec
from shared.event_bus import EventBus

logger = logging.getLogger(__name__)
app = FastAPI(title="Agent Team Gateway", version="1.0.0")
bus: EventBus | None = None


class CreateGoalRequest(BaseModel):
    text: str
    budget_usd: float = 50.0
    tags: list[str] = []
    roles: list[str] = []


class CreateTaskRequest(BaseModel):
    goal_id: str
    title: str
    description: str = ""
    role: str
    depends_on: list[str] = []
    priority: str = "normal"
    allowed_paths: list[str] = []
    token_budget: int = 100_000


# In-memory stores (production would use PostgreSQL)
_goals: dict[str, dict] = {}
_tasks: dict[str, dict] = {}
_task_results: dict[str, dict] = {}


async def _get_event_bus():
    global bus
    if bus is None:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        bus = EventBus(redis_url)
        await bus.connect()
    return bus


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


@app.post("/goals", status_code=201)
async def create_goal(req: CreateGoalRequest):
    goal_id = str(uuid.uuid4())[:8]
    goal = {
        "id": goal_id,
        "text": req.text,
        "budget_usd": req.budget_usd,
        "tags": req.tags,
        "roles": req.roles,
        "status": "pending",
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    _goals[goal_id] = goal
    logger.info("Gateway created goal %s", goal_id)
    return goal


@app.get("/goals/{goal_id}")
async def get_goal(goal_id: str):
    goal = _goals.get(goal_id)
    if not goal:
        raise HTTPException(404, f"Goal {goal_id} not found")
    tasks = [t for t in _tasks.values() if t["goal_id"] == goal_id]
    result = {**goal, "tasks": tasks}
    return result


@app.get("/goals/{goal_id}/tasks")
async def list_goal_tasks(goal_id: str):
    results = [_task_results[tid] for tid in _tasks if _tasks.get(tid, {}).get("goal_id") == goal_id]
    return results


@app.post("/goals/{goal_id}/tasks", status_code=201)
async def create_task(goal_id: str, req: CreateTaskRequest):
    if goal_id not in _goals:
        raise HTTPException(404, "Goal not found")
    task_id = str(uuid.uuid4())[:8]
    task = {
        "id": task_id,
        "goal_id": goal_id,
        "title": req.title,
        "role": req.role,
        "depends_on": req.depends_on,
        "priority": req.priority,
        "allowed_paths": req.allowed_paths,
        "token_budget": req.token_budget,
        "status": "queued",
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    _tasks[task_id] = task
    if bus:
        await bus.publish("task_created", task)
    return task
