"""
Scheduling API URLs.
"""

from django.urls import include, path

from .routers import router
from .views.capacity import (
    SchedulingCapacityView,
    SchedulingOverbookingView,
    SchedulingResolveOverbookingView,
)

app_name = "scheduling"

urlpatterns = [
    # Capacity and overbooking (moved here from Production, same paths: API-SCH-12)
    path("capacity/", SchedulingCapacityView.as_view(), name="capacity"),
    path("overbooking/", SchedulingOverbookingView.as_view(), name="overbooking"),
    path(
        "resolve-overbooking/",
        SchedulingResolveOverbookingView.as_view(),
        name="resolve-overbooking",
    ),
    path("", include(router.urls)),
]
