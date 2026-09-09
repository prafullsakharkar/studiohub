from .base import PersonSerializer
from .create import PersonCreateSerializer
from .detail import PersonDetailSerializer
from .list import PersonListSerializer
from .update import PersonUpdateSerializer

__all__ = [
    "PersonSerializer",
    "PersonCreateSerializer",
    "PersonDetailSerializer",
    "PersonListSerializer",
    "PersonUpdateSerializer",
]
