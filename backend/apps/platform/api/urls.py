"""
Platform API URLs.
"""
from rest_framework.routers import DefaultRouter

from apps.platform.api.viewsets import (
    ProductionReportViewSet,
    StudioNotificationViewSet,
)

app_name = "platform"

router = DefaultRouter()
router.register(r"notifications", StudioNotificationViewSet, basename="notification")
router.register(r"reports", ProductionReportViewSet, basename="report")

urlpatterns = router.urls
