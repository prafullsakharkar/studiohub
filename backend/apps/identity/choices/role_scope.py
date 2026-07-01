from django.db import models


class RoleScope(models.TextChoices):
    GLOBAL = "global", "Global"

    ORGANIZATION = "organization", "Organization"

    PROJECT = "project", "Project"

    SEQUENCE = "sequence", "Sequence"

    SHOT = "shot", "Shot"
