"""
Enterprise business entity base model.
"""

from __future__ import annotations

from apps.core.models.bases.audit import AuditModel
from apps.core.models.bases.metadata import MetadataModel
from apps.core.models.bases.soft_delete import SoftDeleteModel
from apps.core.models.bases.timestamp import TimeStampedModel
from apps.core.models.bases.uuid import UUIDModel


class EntityModel(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
):
    """
    Base class for business entities.
    """

    class Meta:
        abstract = True
