"""Read-only admin for in-app notifications (docs/review-pipeline RP-6)."""

from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(StudioHubModelAdmin):
    """Read-only: rows are written by ``FanoutService`` and change only when their reader reads them."""

    list_display = ("recipient", "kind", "target_type", "created_at", "read_at")
    list_filter = ("kind", "target_type")
    readonly_fields = tuple(field.name for field in Notification._meta.fields)
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
