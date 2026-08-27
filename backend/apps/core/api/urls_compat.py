"""
Compat URLs for frontend contract.

Exposes core resources at frontend-expected paths without changing canonical routes.

Canonical: /api/v1/core/attachments/
Compat:   /api/v1/attachments/   (frontend production contract)
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.core.api.viewsets.attachment import AttachmentViewSet

router = DefaultRouter()
router.register(r"", AttachmentViewSet, basename="attachment-compat")

app_name = "core-compat"

urlpatterns = [
    path("", include(router.urls)),
]
