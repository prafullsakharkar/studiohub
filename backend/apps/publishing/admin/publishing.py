from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.publishing.models import (
    PublishDestination,
    PublishItem,
    PublishValidationRule,
)


@admin.register(PublishItem)
class PublishItemAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "organization",
        "project",
        "entity_type",
        "entity_code",
        "status",
        "export_format",
        "retry_count",
        "is_archived",
    )

    list_filter = (
        "status",
        "entity_type",
        "export_format",
        "is_archived",
        "organization",
    )

    search_fields = (
        "code",
        "name",
        "entity_code",
        "entity_name",
    )

    autocomplete_fields = ("organization", "project")

    list_select_related = ("organization", "project")

    ordering = ("-created_at",)


@admin.register(PublishDestination)
class PublishDestinationAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "destination_type",
        "protocol",
        "region",
        "is_default",
        "is_active",
    )

    list_filter = (
        "destination_type",
        "is_default",
        "is_active",
        "organization",
    )

    search_fields = ("name", "path")

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)

    ordering = ("name",)


@admin.register(PublishValidationRule)
class PublishValidationRuleAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "organization",
        "rule_type",
        "action",
        "is_active",
        "order",
    )

    list_filter = (
        "rule_type",
        "is_active",
        "organization",
    )

    search_fields = ("name",)

    autocomplete_fields = ("organization",)

    list_select_related = ("organization",)

    ordering = ("order",)
