"""Control Room URL routing."""
from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("goals/", views.goal_list, name="goal-list"),
    path("goals/<str:goal_id>/", views.goal_detail, name="goal-detail"),
    path("tasks/", views.task_list, name="task-list"),
    path("tasks/<str:task_id>/", views.task_detail, name="task-detail"),
    path("agents/", views.agent_management, name="agent-management"),
    path("budget/", views.budget_view, name="budget-view"),
    path("approvals/", views.approvals_view, name="approvals"),
    path("health", views.health_check, name="health"),
]
