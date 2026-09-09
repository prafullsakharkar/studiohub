"""
Base models for Production bounded context.
"""

from django.db import models

from apps.core.models.bases import EntityModel


class ProductionEntityModel(EntityModel):
    """
    Base for production entities that belong to an Organization and optionally a Project.

    Provides organization and project FKs for scoping.
    """

    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)ss",
        db_index=True,
    )

    class Meta:
        abstract = True
