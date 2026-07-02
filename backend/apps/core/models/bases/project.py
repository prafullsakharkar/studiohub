"""
Project owned entity.
"""

from __future__ import annotations

from apps.core.models.bases.entity import EntityModel
from apps.core.models.bases.ownership import (
    ProjectOwnedModel,
)


class ProjectEntityModel(
    ProjectOwnedModel,
    EntityModel,
):
    """
    Base model for project-owned entities.
    """

    class Meta:
        abstract = True
