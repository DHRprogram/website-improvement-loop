"""Django ORM models for the orchestrator service."""

import uuid
from django.db import models


class Goal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    text = models.TextField(help_text="Natural language goal description")
    status = models.CharField(max_length=32, default="pending", choices=[
        ("pending", "Pending"), ("planned", "Planned"),
        ("running", "Running"), ("completed", "Completed"),
        ("failed", "Failed"), ("cancelled", "Cancelled"),
    ])
    priority = models.CharField(max_length=16, default="normal", choices=[
        ("low", "Low"), ("normal", "Normal"), ("high", "High"), ("critical", "Critical"),
    ])
    roles = models.JSONField(default=list, blank=True)
    budget_usd = models.FloatField(default=0.0)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Goal {self.id}: {self.text[:80]}"


class TaskSpec(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name="tasks")
    title = models.TextField()
    description = models.TextField(blank=True)
    role = models.CharField(max_length=32)
    depends_on = models.JSONField(default=list, blank=True)
    priority = models.CharField(max_length=16, default="normal")
    allowed_paths = models.JSONField(default=list, blank=True)
    token_budget = models.IntegerField(default=100_000)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Task {self.id} [{self.role}] → Goal {self.goal_id}"


class TaskResult(models.Model):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    STATUS_CHOICES = [
        (PENDING, "Pending"), (RUNNING, "Running"), (SUCCESS, "Success"),
        (FAILED, "Failed"), (PARTIAL, "Partial"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(TaskSpec, on_delete=models.CASCADE, related_name="results")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=PENDING)
    artifacts = models.JSONField(default=list, blank=True)
    tokens_used = models.IntegerField(default=0)
    cost_usd = models.FloatField(default=0.0)
    latency_ms = models.IntegerField(default=0)
    logs = models.TextField(default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"TaskResult {self.id}: {self.status}"


class ApprovalRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE)
    task = models.ForeignKey(TaskSpec, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=32)
    details = models.JSONField(default=dict)
    granted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Approval {self.id}: {self.action} ({'granted' if self.granted else 'pending'})"
