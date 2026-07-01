from django.db import models


class PermissionModule(models.TextChoices):

    ORGANIZATION = "organization", "Organization"

    USER = "user", "User"

    ROLE = "role", "Role"

    TEAM = "team", "Team"

    PROJECT = "project", "Project"

    SEQUENCE = "sequence", "Sequence"

    SHOT = "shot", "Shot"

    ASSET = "asset", "Asset"

    REVIEW = "review", "Review"

    PIPELINE = "pipeline", "Pipeline"

    STORAGE = "storage", "Storage"
