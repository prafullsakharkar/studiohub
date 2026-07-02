"""
Organization owned entity.
"""

from __future__ import annotations

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.ownership import (
    OrganizationOwnedModel,
)


class OrganizationEntityModel(
    OrganizationOwnedModel,
    EntityModel,
):
    """
    Base model for organization-owned entities.
    """

    class Meta:
        abstract = True
