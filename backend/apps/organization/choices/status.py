from django.db import models


class OrganizationStatus(models.TextChoices):
    """
    Organization lifecycle.
    """

    ACTIVE = "active", "Active"

    INACTIVE = "inactive", "Inactive"

    ARCHIVED = "archived", "Archived"
