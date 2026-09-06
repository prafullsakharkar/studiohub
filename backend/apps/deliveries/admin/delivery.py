from django.contrib import admin

from apps.deliveries.models import (
    DeliveryDestination,
    DeliveryPackage,
    DeliveryVersionRef,
)
from apps.organization.admin.base import (
    OrganizationScopedAdminMixin,
    OrganizationScopedModelAdmin,
)


@admin.register(DeliveryPackage)
class DeliveryPackageAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "organization",
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
        "organization",
    )

    search_fields = (
        "code",
        "name",
        "passcode",
    )

    autocomplete_fields = ("organization", "project", "client")

    list_select_related = ("organization", "project", "client")

    date_hierarchy = "expires_at"

    ordering = ("-created_at",)


@admin.register(DeliveryDestination)
class DeliveryDestinationAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "destination_type",
        "storage_region",
        "is_default",
        "is_active",
    )

    list_filter = (
        "destination_type",
        "is_default",
        "is_active",
        "organization",
    )

    search_fields = (
        "name",
        "endpoint",
        "target_directory",
    )

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)

    ordering = ("name",)


@admin.register(DeliveryVersionRef)
class DeliveryVersionRefAdmin(OrganizationScopedAdminMixin, admin.ModelAdmin):
    organization_lookup = "delivery__organization"

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
