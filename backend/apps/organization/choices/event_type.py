from django.db import models


class CalendarEventType(models.TextChoices):
    MILESTONE = "milestone", "Milestone"
    MAINTENANCE = "maintenance", "Maintenance"
    TURNOVER = "turnover", "Turnover"
    GENERAL = "general", "General"
