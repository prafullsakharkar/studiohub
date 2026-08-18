"""
Audit admin.
"""

from django.contrib import admin

from apps.audit.models.activity import Activity
from apps.audit.models.api_request import APIRequest
from apps.audit.models.audit_log import AuditLog
from apps.audit.models.background_job import BackgroundJob
from apps.audit.models.change_log import ChangeLog
from apps.audit.models.error_log import ErrorLog
from apps.audit.models.login_history import LoginHistory
from apps.audit.models.track import Track


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Audit Log admin."""

    list_display = [
        "id",
        "action",
        "severity",
        "target_type",
        "target_id",
        "actor",
        "organization",
        "created_at",
    ]
    list_filter = [
        "action",
        "severity",
        "target_type",
        "created_at",
    ]
    search_fields = ["id", "actor__email", "organization__name", "target_id"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "action",
                    "severity",
                )
            },
        ),
        (
            "Target",
            {
                "fields": (
                    "target_type",
                    "target_id",
                )
            },
        ),
        (
            "Actor & Organization",
            {
                "fields": (
                    "actor",
                    "organization",
                )
            },
        ),
        (
            "Details",
            {"fields": ("description",)},
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    """Activity admin."""

    list_display = [
        "id",
        "activity_type",
        "status",
        "description",
        "created_at",
    ]
    list_filter = [
        "activity_type",
        "status",
        "created_at",
    ]
    search_fields = ["id", "user__email", "description"]
    readonly_fields = ["created_at", "updated_at"]

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "activity_type",
                    "status",
                    "description",
                )
            },
        ),
        (
            "User & Organization",
            {
                "fields": (
                    "user",
                    "organization",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    """Login History admin."""

    list_display = [
        "id",
        "user",
        "organization",
        "ip_address",
        "user_agent",
        "status",
        "created_at",
    ]
    list_filter = [
        "status",
        "created_at",
    ]
    search_fields = ["id", "user__email", "organization__name", "ip_address"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "user",
                    "organization",
                )
            },
        ),
        (
            "Login Details",
            {
                "fields": (
                    "ip_address",
                    "user_agent",
                    "status",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(ChangeLog)
class ChangeLogAdmin(admin.ModelAdmin):
    """Change Log admin."""

    list_display = [
        "id",
        "target_type",
        "target_id",
        "change_type",
        "user",
        "created_at",
    ]
    list_filter = [
        "change_type",
        "created_at",
    ]
    search_fields = ["id", "target_id", "user__email"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "change_type",
                    "target_type",
                    "target_id",
                )
            },
        ),
        (
            "Change Details",
            {
                "fields": (
                    "changed_fields",
                    "before_values",
                    "after_values",
                )
            },
        ),
        (
            "User",
            {"fields": ("user",)},
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(APIRequest)
class APIRequestAdmin(admin.ModelAdmin):
    """API Request admin."""

    list_display = [
        "id",
        "user",
        "organization",
        "path",
        "method",
        "status_code",
        "response_time_ms",
        "created_at",
    ]
    list_filter = [
        "method",
        "status_code",
        "created_at",
    ]
    search_fields = ["id", "user__email", "organization__name", "path"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "user",
                    "organization",
                )
            },
        ),
        (
            "Request Details",
            {
                "fields": (
                    "path",
                    "method",
                    "status_code",
                    "response_time_ms",
                )
            },
        ),
        (
            "Request Data",
            {
                "fields": (
                    "request_headers",
                    "request_body",
                    "response_headers",
                    "response_body",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(BackgroundJob)
class BackgroundJobAdmin(admin.ModelAdmin):
    """Background Job admin."""

    list_display = [
        "id",
        "job_type",
        "status",
        "started_at",
        "completed_at",
        "created_at",
    ]
    list_filter = [
        "status",
        "created_at",
    ]
    search_fields = ["id", "job_id"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "started_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "job_type",
                    "status",
                )
            },
        ),
        (
            "Timing",
            {
                "fields": (
                    "started_at",
                    "completed_at",
                )
            },
        ),
        (
            "Details",
            {
                "fields": (
                    "result_data",
                    "error_message",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    """Error Log admin."""

    list_display = [
        "id",
        "severity",
        "error_type",
        "message",
        "user",
        "organization",
        "created_at",
    ]
    list_filter = [
        "severity",
        "created_at",
    ]
    search_fields = ["id", "message", "stack_trace", "user__email"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "severity",
                    "error_type",
                    "message",
                )
            },
        ),
        (
            "Details",
            {
                "fields": (
                    "stack_trace",
                    "user",
                    "organization",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    """Track admin."""

    list_display = [
        "id",
        "event_type",
        "event_name",
        "user",
        "organization",
        "created_at",
    ]
    list_filter = [
        "event_type",
        "created_at",
    ]
    search_fields = ["id", "user__email", "organization__name"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy = "created_at"

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "id",
                    "event_type",
                    "event_name",
                )
            },
        ),
        (
            "Properties",
            {"fields": ("metadata",)},
        ),
        (
            "User & Organization",
            {
                "fields": (
                    "user",
                    "organization",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
