"""
Permission categories.
"""

from django.db import models


class PermissionCategory(models.TextChoices):
    IDENTITY = "identity", "Identity"

    ORGANIZATION = "organization", "Organization"

    PRODUCTION = "production", "Production"

    REVIEW = "review", "Review"

    ASSET = "asset", "Asset"

    PIPELINE = "pipeline", "Pipeline"

    STORAGE = "storage", "Storage"

    REPORTING = "reporting", "Reporting"

    ADMINISTRATION = "administration", "Administration"
