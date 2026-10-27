from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.deliveries.models import (
    DeliveryCounter,
    DeliveryDestination,
    DeliveryItemFile,
    DeliveryPackage,
    DeliveryQCCheck,
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


@admin.register(DeliveryCounter)
class DeliveryCounterAdmin(ViewOnlyAdmin):
    list_display = ("project_id", "last_number")
