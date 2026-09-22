"""HTMX view functions for the control room dashboard."""

from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from orchestrator.models import Goal, TaskSpec, TaskResult


def health_check(request):
    return JsonResponse({"status": "ok", "service": "control-room"})


def dashboard(request):
    goals = Goal.objects.all()[:10]
    pending_approvals = []
    recent_tasks = TaskResult.objects.all()[:20]
    return render(request, "control_room/dashboard.html", {
        "goals": goals, "pending_approvals": pending_approvals,
        "recent_tasks": recent_tasks,
    })


def goal_list(request):
    goals = Goal.objects.all().order_by("-created_at")
    return render(request, "control_room/goal_list.html", {"goals": goals})


def goal_detail(request, goal_id):
    goal = get_object_or_404(Goal, id=goal_id)
    tasks = TaskSpec.objects.filter(goal=goal).order_by("priority")
    results = TaskResult.objects.filter(task__goal=goal)[:50]
    return render(request, "control_room/goal_detail.html", {
        "goal": goal, "tasks": tasks, "results": results,
    })


def task_list(request):
    tasks = TaskSpec.objects.all().order_by("-created_at")[:50]
    return render(request, "control_room/task_list.html", {"tasks": tasks})


def task_detail(request, task_id):
    task = get_object_or_404(TaskSpec, id=task_id)
    results = TaskResult.objects.filter(task=task).order_by("-created_at")
    return render(request, "control_room/task_detail.html", {
        "task": task, "results": results,
    })


def agent_management(request):
    """List and manage active agent workers."""
    agents = {
        "designer": {"running": 0, "completed": 0},
        "frontend": {"running": 0, "completed": 0},
        "backend": {"running": 0, "completed": 0},
        "qa": {"running": 0, "completed": 0},
        "security": {"running": 0, "completed": 0},
        "devops": {"running": 0, "completed": 0},
        "reviewer": {"running": 0, "completed": 0},
    }
    return render(request, "control_room/agents.html", {"agents": agents})


def budget_view(request):
    return render(request, "control_room/budget.html", {})


@require_http_methods(["POST"])
def approve_task(request, task_id):
    """Grant approval for a draft PR or task completion."""
    # In production: update ApprovalRequest table
    return JsonResponse({"approved": True, "task_id": task_id})


@require_http_methods(["POST"])
def reject_task(request, task_id):
    """Reject a task back for revision."""
    return JsonResponse({"rejected": True, "task_id": task_id})
