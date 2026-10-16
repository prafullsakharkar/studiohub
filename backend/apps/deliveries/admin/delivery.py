from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.deliveries.models import (
    DeliveryDestination,
    DeliveryPackage,
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
        "passcode",
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
