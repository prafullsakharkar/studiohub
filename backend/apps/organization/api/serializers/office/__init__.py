from .base import OfficeBaseSerializer
from .create import OfficeCreateSerializer
from .detail import OfficeDetailSerializer
from .list import OfficeListSerializer
from .nested import OfficeNestedSerializer
from .update import OfficeUpdateSerializer

__all__ = [
    "OfficeBaseSerializer",
    "OfficeListSerializer",
    "OfficeDetailSerializer",
    "OfficeCreateSerializer",
    "OfficeUpdateSerializer",
    "OfficeNestedSerializer",
]
