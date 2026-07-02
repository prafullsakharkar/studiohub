"""
User owned entity.
"""

from __future__ import annotations

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.ownership import (
    UserOwnedModel,
)


class UserEntityModel(
    UserOwnedModel,
    EntityModel,
):
    """
    Base model for user-owned entities.
    """

    class Meta:
        abstract = True
