"""
Notifications app configuration (docs/review-pipeline RP-6).

The in-app inbox: rows written when something happens to a person's work, read behind the bell.
Its handlers are registered by core event autodiscovery (``events.register_events``).
"""

from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
    verbose_name = "Notifications"
