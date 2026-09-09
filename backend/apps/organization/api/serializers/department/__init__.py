from .base import DepartmentSerializer
from .create import DepartmentCreateSerializer
from .detail import DepartmentDetailSerializer
from .list import DepartmentListSerializer
from .nested import DepartmentNestedSerializer
from .summary import DepartmentSummarySerializer
from .update import DepartmentUpdateSerializer

DepartmentBaseSerializer = DepartmentSerializer

__all__ = [
    "DepartmentSerializer",
    "DepartmentBaseSerializer",
    "DepartmentCreateSerializer",
    "DepartmentUpdateSerializer",
    "DepartmentNestedSerializer",
    "DepartmentSummarySerializer",
    "DepartmentListSerializer",
    "DepartmentDetailSerializer",
]
