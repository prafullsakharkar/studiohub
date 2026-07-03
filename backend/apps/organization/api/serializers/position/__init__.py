from .base import DepartmentSerializer
from .create import DepartmentCreateSerializer
from .detail import DepartmentDetailSerializer
from .list import DepartmentListSerializer
from .nested import DepartmentNestedSerializer
from .summary import DepartmentSummarySerializer
from .update import DepartmentUpdateSerializer

__all__ = [
    "DepartmentSerializer",
    "DepartmentCreateSerializer",
    "DepartmentUpdateSerializer",
    "DepartmentNestedSerializer",
    "DepartmentSummarySerializer",
    "DepartmentListSerializer",
    "DepartmentDetailSerializer",
]
