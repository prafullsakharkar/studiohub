"""
Scheduling admin module.
"""

from .scheduling import (
    CalendarEventAdmin,
    HolidayAdmin,
    MilestoneAdmin,
    ResourceAdmin,
    ResourceLeaveAdmin,
    ResourceScheduleAdmin,
    WorkCalendarAdmin,
)

__all__ = [
    "ResourceAdmin",
    "CalendarEventAdmin",
    "HolidayAdmin",
    "MilestoneAdmin",
    "ResourceLeaveAdmin",
    "ResourceScheduleAdmin",
    "WorkCalendarAdmin",
]
