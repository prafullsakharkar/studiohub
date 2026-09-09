from django.db import models


class TaskStatus(models.TextChoices):
    NOT_STARTED = "Not Started", "Not Started"
    IN_PROGRESS = "In Progress", "In Progress"
    PENDING_REVIEW = "Pending Review", "Pending Review"
    APPROVED = "Approved", "Approved"
    RETAKE = "Retake", "Retake"
    ARCHIVED = "Archived", "Archived"


class TaskPriority(models.TextChoices):
    CRITICAL = "Critical", "Critical"
    HIGH = "High", "High"
    MEDIUM = "Medium", "Medium"
    LOW = "Low", "Low"
