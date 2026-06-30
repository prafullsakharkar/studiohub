from .bases.audit import AuditModel
from .bases.color import ColorModel
from .bases.metadata import MetadataModel
from .bases.orderable import OrderableModel
from .bases.publishable import PublishableModel
from .bases.soft_delete import SoftDeleteModel
from .bases.timestamp import TimeStampedModel
from .bases.uuid import UUIDModel
from .mixins.soft_delete import SoftDeleteMixin


class BaseModel(
    UUIDModel,
    TimeStampedModel,
    SoftDeleteModel,
    AuditModel,
    OrderableModel,
    PublishableModel,
    MetadataModel,
    ColorModel,
    SoftDeleteMixin,
):
    """
    Base model inherited by all domain models.
    """

    class Meta:
        abstract = True
