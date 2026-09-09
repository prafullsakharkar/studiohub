"""
Base models for the Organization bounded context.
"""

from django.db import models

from apps.core.models.bases import EntityModel, OrganizationOwnedModel


class OrganizationEntityModel(OrganizationOwnedModel, EntityModel):
    """
    Base model for reusable organizational entities.

    Used by:

        • Department
        • Team
        • Office
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

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
