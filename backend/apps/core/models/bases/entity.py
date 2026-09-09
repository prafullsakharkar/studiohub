"""
Enterprise business entity base model.
"""

from __future__ import annotations

from apps.core.models.bases.audit import AuditModel
from apps.core.models.bases.soft_delete import SoftDeleteModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.core.models.bases.uuid import UUIDModel
from apps.core.models.mixins.soft_delete import SoftDeleteMixin


class EntityModel(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    SoftDeleteModel,
    SoftDeleteMixin,
):
    """
    Base class for business entities.
    """

    class Meta:
        abstract = True
