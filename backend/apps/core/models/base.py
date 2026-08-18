from .bases.audit import AuditModel
from .bases.color import ColorModel
from .bases.metadata import MetadataModel
from .bases.notes import NotesModel
from .bases.orderable import OrderableModel
from .bases.ownership import OrganizationOwnedModel
from .bases.publishable import PublishableModel
from .bases.soft_delete import SoftDeleteModel
from .bases.timestamp import TimeStampedModel
from .bases.uuid import UUIDModel
from .mixins.soft_delete import SoftDeleteMixin


import warnings


class BaseModel(
    UUIDModel,
    TimeStampedModel,
    SoftDeleteModel,
    AuditModel,
    OrderableModel,
    PublishableModel,
    MetadataModel,
    NotesModel,
    OrganizationOwnedModel,
    ColorModel,
    SoftDeleteMixin,
):
    """
    Legacy convenience BaseModel.

    NOTE: This class aggregates many capabilities for convenience and is
    preserved for backward compatibility. Prefer composition with small
    mixins for new models. For example:

        class MyModel(UUIDModel, TimeStampedModel, MetadataModel):
            ...

    The monolithic BaseModel will remain available but may be phased out in
    favour of composable mixins in future releases. When migrating, prefer to
    depend on explicit mixins rather than the large BaseModel.
    """

    # Emit a deprecation-style notice at import time to guide developers.
    warnings.warn(
        "apps.core.models.base.BaseModel is a convenience aggregate. Prefer composing lightweight mixins (UUIDModel, TimeStampedModel, SoftDeleteModel, AuditModel, etc.) in new code.",
        FutureWarning,
    )

    class Meta:
        abstract = True
