from rest_framework.routers import DefaultRouter

from apps.scheduling.api.viewsets import (
    CalendarEventViewSet,
    HolidayViewSet,
    MilestoneViewSet,
    ResourceLeaveViewSet,
    ResourceScheduleViewSet,
    ResourceViewSet,
    WorkCalendarViewSet,
)

router = DefaultRouter()
router.register(r"events", CalendarEventViewSet, basename="calendar-event")
router.register(r"resources", ResourceViewSet, basename="resource")
router.register(r"schedules", ResourceScheduleViewSet, basename="resource-schedule")
router.register(r"leaves", ResourceLeaveViewSet, basename="resource-leave")
router.register(r"holidays", HolidayViewSet, basename="holiday")
router.register(r"calendars", WorkCalendarViewSet, basename="work-calendar")
router.register(r"milestones", MilestoneViewSet, basename="milestone")

urlpatterns = router.urls
