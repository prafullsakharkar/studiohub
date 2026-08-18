"""
URLs for Core API.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.core.api.viewsets.attachment import AttachmentViewSet
from apps.core.api.viewsets.tag import TagViewSet

router = DefaultRouter()
router.register(r"attachments", AttachmentViewSet, basename="attachment")
router.register(r"tags", TagViewSet, basename="tag")

app_name = "core"

urlpatterns = [
    path("", include(router.urls)),
]
