from django.db import models


class RoleScope(models.TextChoices):
    """
    Role scope choices for organization roles.
    """

    ORGANIZATION = "organization", "Organization"
    DEPARTMENT = "department", "Department"
    TEAM = "team", "Team"
    OFFICE = "office", "Office"

