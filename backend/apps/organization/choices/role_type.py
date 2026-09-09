from django.db import models


class RoleType(models.TextChoices):
    """
    Role type choices for organization roles.
    """

    ORGANIZATION = "organization", "Organization"
    DEPARTMENT = "department", "Department"
    TEAM = "team", "Team"
    OFFICE = "office", "Office"

