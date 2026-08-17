"""
Business service.
Deprecated: Use CRUDService, LifecycleService, and SoftDeleteService directly.
This class is kept for backward compatibility.
"""

from __future__ import annotations

from apps.core.services.crud import CRUDService
from apps.core.services.lifecycle import LifecycleService
from apps.core.services.mixins.soft_delete import SoftDeleteMixin


class BusinessService(
    SoftDeleteMixin,
    LifecycleService,
    CRUDService,
):
    """
    Base class for all business services.
    DEPRECATED: This god-class has been split into focused services.
    Use CRUDService, LifecycleService, and SoftDeleteService directly.
    """

    # Keep for backward compatibility - all methods are inherited
    pass
