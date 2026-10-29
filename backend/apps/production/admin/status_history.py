from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import StatusHistory


@admin.register(StatusHistory)
class StatusHistoryAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    """Read-only: history is written by ``StatusService`` only."""

    list_display = ("entity_type", "entity_code", "from_status", "to_status", "actor", "changed_at")
    list_filter = ("entity_type", "to_status")
    search_fields = ("entity_code", "reason")
    readonly_fields = tuple(field.name for field in StatusHistory._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
