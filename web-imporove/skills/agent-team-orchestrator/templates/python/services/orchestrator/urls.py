from django.urls import path
from .main import api_health, list_goals, get_goal, plan_goal

urlpatterns = [
    path("health", api_health, name="health"),
    path("goals", list_goals, name="list-goals"),
    path("goals/<str:goal_id>", get_goal, name="get-goal"),
    path("goals/<str:goal_id>/plan", plan_goal, name="plan-goal"),
]
