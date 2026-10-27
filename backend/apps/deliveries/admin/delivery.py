from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.deliveries.models import (
    DeliveryCounter,
    DeliveryDestination,
    DeliveryItemFile,
    DeliveryPackage,
    DeliveryQCCheck,
    DeliveryStatusChange,
    DeliveryVersionRef,
)


@admin.register(DeliveryPackage)
class DeliveryPackageAdmin(PlatformScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "client",
        "status",
        "delivery_method",
        "expires_at",
    )

    list_filter = (
        "status",
        "client_status",
        "delivery_method",
        "is_archived",
    )

    search_fields = (
        "code",
        "name",
    )

    # The passcode is a secret for an external service (DLV-01): never searchable, never in a form.
    exclude = ("passcode",)

    # The status and everything the workflow writes are not editable here: the admin would
    # bypass the transition map, separation of duties and the history (DOM-DLV-02).
    readonly_fields = (
        "status",
        "client_status",
        "sent_by",
        "sent_at",
        "transfer_reference",
        "qc_run_id",
        "signed_off_by",
        "signed_off_at",
        "client_answered_by",
        "client_answered_at",
        "cancellation_reason",
        "rejection_reason",
        "revision_of",
        "manifest_data",
        "checksums",
        "total_size_bytes",
        "total_frames",
        "is_archived",
    )

    list_select_related = ("project", "client")

    date_hierarchy = "expires_at"

    ordering = ("-created_at",)


@admin.register(DeliveryDestination)
class DeliveryDestinationAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "destination_type",
        "storage_region",
        "is_default",
        "is_active",
    )

    list_filter = (
        "destination_type",
        "is_default",
        "is_active",
    )

    search_fields = (
        "name",
        "endpoint",
        "target_directory",
    )

    ordering = ("name",)


@admin.register(DeliveryVersionRef)
class DeliveryVersionRefAdmin(PlatformScopedModelAdmin):
    list_display = (
        "version_number",
        "delivery",
        "entity_type",
        "entity_code",
        "is_validated",
        "created_at",
    )

    list_filter = (
        "entity_type",
        "is_validated",
    )

    search_fields = (
        "version_number",
        "entity_code",
        "entity_name",
        "checksum_md5",
    )

    autocomplete_fields = ("delivery", "version")

    list_select_related = ("delivery", "version")

    ordering = ("-created_at",)


class ViewOnlyAdmin(admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    """The snapshot, the QC records and the counter are written by the services only."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DeliveryItemFile)
class DeliveryItemFileAdmin(ViewOnlyAdmin):
    list_display = ("storage_root_code", "relative_path", "role", "item", "frozen_at")
    list_filter = ("role",)
    search_fields = ("relative_path",)
    list_select_related = ("item",)


@admin.register(DeliveryQCCheck)
class DeliveryQCCheckAdmin(ViewOnlyAdmin):
    list_display = ("delivery", "check_name", "outcome", "checked_at")
    list_filter = ("check_name", "outcome")
    list_select_related = ("delivery",)
    ordering = ("-checked_at",)


@admin.register(DeliveryStatusChange)
class DeliveryStatusChangeAdmin(ViewOnlyAdmin):
    list_display = ("delivery", "from_status", "to_status", "actor", "override_kind", "at")
    list_filter = ("to_status", "override_kind")
    list_select_related = ("delivery", "actor")
    ordering = ("-at",)


@admin.register(DeliveryCounter)
class DeliveryCounterAdmin(ViewOnlyAdmin):
    list_display = ("project_id", "last_number")
