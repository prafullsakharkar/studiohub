"""
Base models for the Organization bounded context.
"""

from django.db import models

from apps.core.models.bases import OrganizationOwnedModel


class OrganizationEntityModel(OrganizationOwnedModel):
    """
    Base model for reusable organizational entities.

    Used by:

        • Department
        • Team
        • Office
    """

    code = models.CharField(
        max_length=30,
        db_index=True,
    )

    name = models.CharField(
        max_length=255,
        db_index=True,
    )

    description = models.TextField(
        blank=True,
        default="",
    )

    class Meta:
        abstract = True
