"""
Deprecated location of the shared viewset bases.

They live in ``apps.core.api.viewsets.platform_crud`` (delivery-pipeline X-02). This re-export keeps
older imports working and is removed in Phase 12 of the delivery-pipeline work.
"""

from __future__ import annotations

from apps.core.api.viewsets.platform_crud import PlatformCrudViewSet, PlatformReadViewSet

__all__ = ["PlatformCrudViewSet", "PlatformReadViewSet"]
