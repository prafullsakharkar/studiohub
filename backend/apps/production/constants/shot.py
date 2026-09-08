from django.db import models


class ShotStatus(models.TextChoices):
    NOT_STARTED = "Not Started", "Not Started"
    IN_PROGRESS = "In Progress", "In Progress"
    PENDING_REVIEW = "Pending Review", "Pending Review"
    APPROVED = "Approved", "Approved"
    RETAKE = "Retake", "Retake"
    ON_HOLD = "On Hold", "On Hold"
    # Frontend contract: archiving a shot sets status "Archived"
    # (mirrors ProductionStatus; soft-delete remains the recoverable store).
    ARCHIVED = "Archived", "Archived"


class ProductionStatus(models.TextChoices):
    NOT_STARTED = "Not Started", "Not Started"
    IN_PROGRESS = "In Progress", "In Progress"
    PENDING_REVIEW = "Pending Review", "Pending Review"
    APPROVED = "Approved", "Approved"
    RETAKE = "Retake", "Retake"
    ARCHIVED = "Archived", "Archived"
