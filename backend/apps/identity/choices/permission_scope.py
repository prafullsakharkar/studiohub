from django.db import models


class PermissionScope(models.TextChoices):
    GLOBAL = "global", "Global"

    ORGANIZATION = "organization", "Organization"

    PROJECT = "project", "Project"

    OWN = "own", "Own"
