"""Notifications API URLs (docs/review-pipeline RP-6, C-RP-23), mounted at ``notifications/``."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.notifications.api.viewsets import NotificationViewSet

app_name = "notifications"

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("", NotificationViewSet, basename="notification")

urlpatterns = [path("", include(router.urls))]
