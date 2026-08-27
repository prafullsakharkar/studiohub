"""
Production API URLs — mounted at /api/v1/ (top-level) to match frontend contract:

/api/v1/projects/
/api/v1/shots/
/api/v1/assets/
"""

from rest_framework.routers import DefaultRouter

from django.urls import path

from rest_framework.routers import DefaultRouter

from apps.production.api.viewsets.analytics import AnalyticsDepartmentsView, AnalyticsKpisView
from apps.production.api.viewsets.asset import AssetViewSet
from apps.production.api.viewsets.media import MediaViewSet
from apps.production.api.viewsets.playlist import PlaylistViewSet
from apps.production.api.viewsets.project import ProjectViewSet
from apps.production.api.viewsets.review import ReviewViewSet
from apps.production.api.viewsets.scheduling import (
    AutomationAuditLogsView,
    AutomationRuleDetailView,
    AutomationRulesView,
    SchedulingCapacityView,
    SchedulingEventDetailView,
    SchedulingEventsView,
    SchedulingHolidaysView,
    SchedulingLeavesView,
    SchedulingOverbookingView,
    SchedulingResolveOverbookingView,
    SchedulingResourcesView,
)
from apps.production.api.viewsets.shot import ShotViewSet
from apps.production.api.viewsets.task import TaskViewSet
from apps.production.api.viewsets.timelog import TimelogViewSet
from apps.production.api.viewsets.version import VersionViewSet
from apps.production.api.viewsets.workflow import WorkflowViewSet

router = DefaultRouter()

router.register(r"projects", ProjectViewSet, basename="project")
router.register(r"shots", ShotViewSet, basename="shot")
router.register(r"assets", AssetViewSet, basename="asset")
router.register(r"tasks", TaskViewSet, basename="task")
router.register(r"timelogs", TimelogViewSet, basename="timelog")
router.register(r"versions", VersionViewSet, basename="version")
router.register(r"reviews", ReviewViewSet, basename="review")
router.register(r"media", MediaViewSet, basename="media")
router.register(r"playlists", PlaylistViewSet, basename="playlist")
router.register(r"workflows", WorkflowViewSet, basename="workflow")

app_name = "production"

urlpatterns = router.urls + [
    # Automation (bare array, outside workflows)
    path("automations/rules/", AutomationRulesView.as_view(), name="automation-rules-list"),
    path("automations/rules/<str:pk>/", AutomationRuleDetailView.as_view(), name="automation-rules-detail"),
    path("automations/audit-logs/", AutomationAuditLogsView.as_view(), name="automation-audit-logs"),
    # Scheduling (bare arrays)
    path("scheduling/events/", SchedulingEventsView.as_view(), name="scheduling-events"),
    path("scheduling/events/<str:pk>/", SchedulingEventDetailView.as_view(), name="scheduling-event-detail"),
    path("scheduling/resources/", SchedulingResourcesView.as_view(), name="scheduling-resources"),
    path("scheduling/resources/<str:pk>/", SchedulingResourcesView.as_view(), name="scheduling-resource-detail"),
    path("scheduling/capacity/", SchedulingCapacityView.as_view(), name="scheduling-capacity"),
    path("scheduling/overbooking/", SchedulingOverbookingView.as_view(), name="scheduling-overbooking"),
    path("scheduling/resolve-overbooking/", SchedulingResolveOverbookingView.as_view(), name="scheduling-resolve-overbooking"),
    path("scheduling/holidays/", SchedulingHolidaysView.as_view(), name="scheduling-holidays"),
    path("scheduling/leaves/", SchedulingLeavesView.as_view(), name="scheduling-leaves"),
    path("scheduling/leaves/<str:pk>/", SchedulingLeavesView.as_view(), name="scheduling-leave-detail"),
    # Analytics
    path("analytics/kpis/", AnalyticsKpisView.as_view(), name="analytics-kpis"),
    path("analytics/departments/", AnalyticsDepartmentsView.as_view(), name="analytics-departments"),
]
