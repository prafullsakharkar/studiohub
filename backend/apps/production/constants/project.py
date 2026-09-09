from django.db import models


class ProjectType(models.TextChoices):
    FEATURE_FILM = "Feature Film", "Feature Film"
    EPISODIC_SERIES = "Episodic Series", "Episodic Series"
    COMMERCIAL = "Commercial", "Commercial"
    GAME_CINEMATIC = "Game Cinematic", "Game Cinematic"


class ProjectStatus(models.TextChoices):
    IN_PROGRESS = "In Progress", "In Progress"
    PENDING_REVIEW = "Pending Review", "Pending Review"
    APPROVED = "Approved", "Approved"
    ARCHIVED = "Archived", "Archived"
    ON_HOLD = "On Hold", "On Hold"
