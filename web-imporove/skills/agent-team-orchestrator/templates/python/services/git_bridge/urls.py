"""Git Bridge URL routing."""
from django.urls import path
from .main import health_check, create_pr, pr_status

urlpatterns = [
    path("health", health_check, name="health"),
    path("pr", create_pr, name="create-pr"),
    path("pr/<str:pr_id>", pr_status, name="pr-status"),
]
