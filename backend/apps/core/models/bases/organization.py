"""
Organization-scoped entity base.

This is a protocol/interface for domain applications to implement.
Domain applications should define their own organization field.

Example:
    class MyModel(OrganizationScopedModel, EntityModel):
        organization = models.ForeignKey(
            "myapp.Organization",
            on_delete=models.CASCADE,
            related_name="%(app_label)s_%(class)ss",
            db_index=True,
        )
"""

from __future__ import annotations

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.scopes import OrganizationScopedModel


class OrganizationEntityModel(
    OrganizationScopedModel,
    EntityModel,
):
    """
    Base model for organization-scoped entities.

    This is a protocol/interface for domain applications to implement.
    Domain applications should define their own organization field.
    """

    class Meta:
        abstract = True
