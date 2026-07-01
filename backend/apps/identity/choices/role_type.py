from django.db import models


class RoleType(models.TextChoices):
    SYSTEM = "system", "System"

    ORGANIZATION = "organization", "Organization"

    PROJECT = "project", "Project"

    TEMPORARY = "temporary", "Temporary"

    CUSTOM = "custom", "Custom"
