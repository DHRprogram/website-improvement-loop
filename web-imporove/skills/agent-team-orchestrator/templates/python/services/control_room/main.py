"""Control Room — Django + HTMX admin dashboard."""

import os
from django.conf import settings
from django.apps import AppConfig


class ControlRoomConfig(AppConfig):
    name = "services.control_room"
    verbose_name = "Agent Team Control Room"


def get_secret():
    return os.environ.get("DJANGO_SECRET_KEY", "change-me-in-production")
