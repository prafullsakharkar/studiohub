from django.db import models


class RoleScope(models.TextChoices):
    """
    Role scope choices for organization roles.

    Canonical scope lattice (ADR-0033 D1/D2): a role's scope is the ceiling
    of where its granted permissions may apply.
    """

    ORGANIZATION = "organization", "Organization"
    PROJECT = "project", "Project"
    SHOW = "show", "Show"
    DEPARTMENT = "department", "Department"
    TEAM = "team", "Team"
    OFFICE = "office", "Office"

