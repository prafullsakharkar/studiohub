"""Read-only admin for in-app notifications and preferences (docs/review-pipeline RP-6, RP-11)."""

from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.notifications.models import Notification, NotificationPreference


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


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(StudioHubModelAdmin):
    """Read-only: each person saves their own on the Notifications page (C-RP-30)."""

    list_display = ("user", "updated_at")
    readonly_fields = tuple(field.name for field in NotificationPreference._meta.fields)
    ordering = ("-updated_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
