"""
Scheduling models for resource management and calendar events.
"""
from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from apps.core.models.bases.entity import EntityModel
from apps.organization.models.organization import Organization


class CalendarEvent(EntityModel):
    """
    Calendar event for scheduling and planning.
    
    Represents time-blocked events such as meetings, deadlines,
    milestones, and production milestones.
    """
    
    # Event types
    TYPE_MEETING = "Meeting"
    TYPE_DEADLINE = "Deadline"
    TYPE_MILESTONE = "Milestone"
    TYPE_REVIEW = "Review Session"
    TYPE_HOLIDAY = "Holiday"
    TYPE_LEAVE = "Leave"
    TYPE_WORK_BLOCK = "Work Block"
    
    TYPE_CHOICES = [
        (TYPE_MEETING, "Meeting"),
        (TYPE_DEADLINE, "Deadline"),
        (TYPE_MILESTONE, "Milestone"),
        (TYPE_REVIEW, "Review Session"),
        (TYPE_HOLIDAY, "Holiday"),
        (TYPE_LEAVE, "Leave"),
        (TYPE_WORK_BLOCK, "Work Block"),
    ]
    
    # Event statuses
    STATUS_SCHEDULED = "Scheduled"
    STATUS_IN_PROGRESS = "In Progress"
    STATUS_COMPLETED = "Completed"
    STATUS_CANCELLED = "Cancelled"
    STATUS_POSTPONED = "Postponed"
    
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_POSTPONED, "Postponed"),
    ]
    
    # Event visibility
    VISIBILITY_PRIVATE = "Private"
    VISIBILITY_TEAM = "Team"
    VISIBILITY_ORGANIZATION = "Organization"
    VISIBILITY_PUBLIC = "Public"
    
    VISIBILITY_CHOICES = [
        (VISIBILITY_PRIVATE, "Private"),
        (VISIBILITY_TEAM, "Team"),
        (VISIBILITY_ORGANIZATION, "Organization"),
        (VISIBILITY_PUBLIC, "Public"),
    ]
    
    title = models.CharField(
        max_length=255,
        help_text="Event title",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Event description",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="calendar_events",
        db_index=True,
        help_text="Organization context",
    )
    
    project = models.ForeignKey(
        "production.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calendar_events",
        db_index=True,
        help_text="Associated project",
    )
    
    event_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_MEETING,
        db_index=True,
        help_text="Type of event",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_SCHEDULED,
        db_index=True,
        help_text="Event status",
    )
    
    visibility = models.CharField(
        max_length=20,
        choices=VISIBILITY_CHOICES,
        default=VISIBILITY_TEAM,
        help_text="Event visibility",
    )
    
    start_time = models.DateTimeField(
        help_text="Event start time",
    )
    
    end_time = models.DateTimeField(
        help_text="Event end time",
    )
    
    is_all_day = models.BooleanField(
        default=False,
        help_text="Whether this is an all-day event",
    )
    
    location = models.CharField(
        max_length=255,
        blank=True,
        help_text="Event location",
    )
    
    meeting_url = models.URLField(
        blank=True,
        help_text="Virtual meeting URL",
    )
    
    notes = models.TextField(
        blank=True,
        help_text="Internal notes",
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event metadata",
    )
    
    class Meta:
        db_table = "scheduling_calendar_event"
        ordering = ("start_time",)
        verbose_name = "Calendar Event"
        verbose_name_plural = "Calendar Events"
    
    def __str__(self):
        return f"{self.title} ({self.start_time.date()})"
    
    @property
    def duration_minutes(self):
        """Get event duration in minutes."""
        if self.end_time and self.start_time:
            return int((self.end_time - self.start_time).total_seconds() / 60)
        return 0


class Resource(EntityModel):
    """
    Bookable resource (person, equipment, room).
    
    Represents resources that can be scheduled and tracked
    for workload capacity planning.
    """
    
    # Resource types
    TYPE_PERSON = "Person"
    TYPE_EQUIPMENT = "Equipment"
    TYPE_ROOM = "Room"
    TYPE_STUDIO = "Studio"
    
    TYPE_CHOICES = [
        (TYPE_PERSON, "Person"),
        (TYPE_EQUIPMENT, "Equipment"),
        (TYPE_ROOM, "Room"),
        (TYPE_STUDIO, "Studio"),
    ]
    
    # Resource statuses
    STATUS_ACTIVE = "Active"
    STATUS_ON_LEAVE = "On Leave"
    STATUS_UNAVAILABLE = "Unavailable"
    
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_ON_LEAVE, "On Leave"),
        (STATUS_UNAVAILABLE, "Unavailable"),
    ]
    
    name = models.CharField(
        max_length=255,
        help_text="Resource name",
    )
    
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique resource code",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="resources",
        db_index=True,
        help_text="Organization context",
    )
    
    resource_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_PERSON,
        db_index=True,
        help_text="Type of resource",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True,
        help_text="Resource status",
    )
    
    department = models.ForeignKey(
        "organization.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
        db_index=True,
        help_text="Department",
    )
    
    team = models.ForeignKey(
        "organization.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
        db_index=True,
        help_text="Team",
    )
    
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resources",
        db_index=True,
        help_text="Associated user (for person resources)",
    )
    
    capacity_hours_per_week = models.PositiveIntegerField(
        default=40,
        help_text="Weekly capacity in hours",
    )
    
    hourly_rate_usd = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Hourly rate in USD",
    )
    
    location = models.CharField(
        max_length=255,
        blank=True,
        help_text="Physical location",
    )
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional resource metadata",
    )
    
    class Meta:
        db_table = "scheduling_resource"
        ordering = ("name",)
        verbose_name = "Resource"
        verbose_name_plural = "Resources"
    
    def __str__(self):
        return f"{self.name} ({self.code})"


class ResourceSchedule(EntityModel):
    """
    Scheduled time slot for a resource.
    
    Represents a booked time slot for a resource, tracking
    utilization and workload.
    """
    
    # Slot statuses
    STATUS_BOOKED = "Booked"
    STATUS_AVAILABLE = "Available"
    STATUS_BLOCKED = "Blocked"
    STATUS_OVERBOOKED = "Overbooked"
    
    STATUS_CHOICES = [
        (STATUS_BOOKED, "Booked"),
        (STATUS_AVAILABLE, "Available"),
        (STATUS_BLOCKED, "Blocked"),
        (STATUS_OVERBOOKED, "Overbooked"),
    ]
    
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name="schedules",
        db_index=True,
        help_text="Booked resource",
    )
    
    start_time = models.DateTimeField(
        help_text="Slot start time",
    )
    
    end_time = models.DateTimeField(
        help_text="Slot end time",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_AVAILABLE,
        db_index=True,
        help_text="Slot status",
    )
    
    event = models.ForeignKey(
        CalendarEvent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resource_schedules",
        db_index=True,
        help_text="Associated event",
    )
    
    task = models.ForeignKey(
        "production.Task",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resource_schedules",
        db_index=True,
        help_text="Associated task",
    )
    
    notes = models.TextField(
        blank=True,
        help_text="Slot notes",
    )
    
    class Meta:
        db_table = "scheduling_resource_schedule"
        ordering = ("start_time",)
        verbose_name = "Resource Schedule"
        verbose_name_plural = "Resource Schedules"
    
    def __str__(self):
        return f"{self.resource.name}: {self.start_time} - {self.end_time}"


class ResourceLeave(EntityModel):
    """
    Leave request for a resource.
    
    Tracks vacation, sick leave, and other time off requests.
    """
    
    # Leave types
    TYPE_VACATION = "Vacation"
    TYPE_SICK = "Sick Leave"
    TYPE_PERSONAL = "Personal"
    TYPE_UNPAID = "Unpaid"
    TYPE_PARENTAL = "Parental"
    TYPE_BEREAVEMENT = "Bereavement"
    TYPE_OTHER = "Other"
    
    TYPE_CHOICES = [
        (TYPE_VACATION, "Vacation"),
        (TYPE_SICK, "Sick Leave"),
        (TYPE_PERSONAL, "Personal"),
        (TYPE_UNPAID, "Unpaid"),
        (TYPE_PARENTAL, "Parental"),
        (TYPE_BEREAVEMENT, "Bereavement"),
        (TYPE_OTHER, "Other"),
    ]
    
    # Leave statuses
    STATUS_PENDING = "Pending"
    STATUS_APPROVED = "Approved"
    STATUS_REJECTED = "Rejected"
    STATUS_CANCELLED = "Cancelled"
    
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_CANCELLED, "Cancelled"),
    ]
    
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name="leaves",
        db_index=True,
        help_text="Resource requesting leave",
    )
    
    leave_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default=TYPE_VACATION,
        db_index=True,
        help_text="Type of leave",
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
        help_text="Leave status",
    )
    
    start_date = models.DateField(
        help_text="Leave start date",
    )
    
    end_date = models.DateField(
        help_text="Leave end date",
    )
    
    total_days = models.PositiveIntegerField(
        default=0,
        help_text="Total leave days",
    )
    
    reason = models.TextField(
        blank=True,
        help_text="Reason for leave",
    )
    
    approved_by = models.ForeignKey(
        "identity.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_leaves",
        db_index=True,
        help_text="Approving user",
    )
    
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When leave was approved",
    )
    
    rejection_reason = models.TextField(
        blank=True,
        help_text="Reason for rejection",
    )
    
    class Meta:
        db_table = "scheduling_resource_leave"
        ordering = ("-start_date",)
        verbose_name = "Resource Leave"
        verbose_name_plural = "Resource Leaves"
    
    def __str__(self):
        return f"{self.resource.name}: {self.leave_type} ({self.start_date} to {self.end_date})"


class Holiday(EntityModel):
    """
    Company holiday calendar.
    
    Tracks company-wide holidays and observances.
    """
    
    name = models.CharField(
        max_length=255,
        help_text="Holiday name",
    )
    
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="holidays",
        db_index=True,
        help_text="Organization context",
    )
    
    holiday_date = models.DateField(
        help_text="Holiday date",
    )
    
    is_paid = models.BooleanField(
        default=True,
        help_text="Whether this is a paid holiday",
    )
    
    is_optional = models.BooleanField(
        default=False,
        help_text="Whether this holiday is optional",
    )
    
    description = models.TextField(
        blank=True,
        help_text="Holiday description",
    )
    
    class Meta:
        db_table = "scheduling_holiday"
        ordering = ("holiday_date",)
        verbose_name = "Holiday"
        verbose_name_plural = "Holidays"
        unique_together = ("organization", "holiday_date")
    
    def __str__(self):
        return f"{self.name} ({self.holiday_date})"
