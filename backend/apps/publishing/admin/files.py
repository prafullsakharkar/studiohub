"""
Read-only admin for the file registry (docs/publishing/CONTRACTS.md SEC-PUB-05).

A registered file is immutable and its history append-only, so the admin only shows them: no add,
change or delete, for superusers too. Storage roots and the counter are managed through the API
and the numbering service. ``revoke_reason`` is not listed or searchable.
"""

from django.contrib import admin

from apps.publishing.models import (
    PublishCounter,
    PublishedFile,
    PublishedFileEvent,
    StorageRoot,
)


class ReadOnlyAdmin(admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StorageRoot)
class StorageRootAdmin(ReadOnlyAdmin):
    list_display = ("code", "name", "is_active")
    search_fields = ("code", "name")
    ordering = ("code",)


@admin.register(PublishedFile)
class PublishedFileAdmin(ReadOnlyAdmin):
    list_display = ("storage_root", "relative_path", "role", "status", "checksum_state", "project")
    list_filter = ("status", "role", "checksum_state", "storage_root")
    search_fields = ("relative_path",)
    list_select_related = ("storage_root", "project")
    exclude = ("revoke_reason",)
    ordering = ("-created_at",)


@admin.register(PublishedFileEvent)
class PublishedFileEventAdmin(ReadOnlyAdmin):
    list_display = ("file", "kind", "from_status", "to_status", "override_kind", "at")
    list_filter = ("kind", "override_kind")
    exclude = ("reason",)
    ordering = ("-at",)


@admin.register(PublishCounter)
class PublishCounterAdmin(ReadOnlyAdmin):
    list_display = ("project_id", "last_number")
