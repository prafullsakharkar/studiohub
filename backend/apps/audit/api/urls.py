"""
URLs for Audit API.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit.api.viewsets.activity import ActivityViewSet
from apps.audit.api.viewsets.api_request import APIRequestViewSet
from apps.audit.api.viewsets.audit_log import AuditCompatViewSet, AuditLogViewSet
from apps.audit.api.viewsets.background_job import BackgroundJobViewSet
from apps.audit.api.viewsets.change_log import ChangeLogViewSet
from apps.audit.api.viewsets.error_log import ErrorLogViewSet
from apps.audit.api.viewsets.login_history import LoginHistoryViewSet
from apps.audit.api.viewsets.track import TrackViewSet

router = DefaultRouter()
router.register(r"audit-logs", AuditLogViewSet, basename="audit-log")
router.register(r"activities", ActivityViewSet, basename="activity")
router.register(r"login-history", LoginHistoryViewSet, basename="login-history")
router.register(r"change-logs", ChangeLogViewSet, basename="change-log")
router.register(r"api-requests", APIRequestViewSet, basename="api-request")
router.register(r"background-jobs", BackgroundJobViewSet, basename="background-job")
router.register(r"error-logs", ErrorLogViewSet, basename="error-log")
router.register(r"tracks", TrackViewSet, basename="track")


urlpatterns = [
    # Flat frontend-contract alias (list only; audit stays append-only).
    path("", AuditCompatViewSet.as_view({"get": "list"}), name="audit-flat-list"),
    path("", include(router.urls)),
]
