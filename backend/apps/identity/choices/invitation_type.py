from django.db import models


class InvitationType(models.TextChoices):
    ORGANIZATION = "organization", "Organization"

    DEPARTMENT = "department", "Department"

    TEAM = "team", "Team"
