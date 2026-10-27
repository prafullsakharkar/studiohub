from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.publishing.admin.files import ViewOnlyMixin
from apps.publishing.models import (
    PublishDestination,
    PublishItem,
    PublishValidationRule,
)


@admin.register(PublishItem)
class PublishItemAdmin(ViewOnlyMixin, PlatformScopedModelAdmin):
    list_display = (
        "code",
        "name",
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
    )

    search_fields = (
        "code",
        "name",
        "entity_code",
        "entity_name",
    )

    autocomplete_fields = ("project",)

    list_select_related = ("project",)

    ordering = ("-created_at",)

    # View only: numbering, project checks and the status map live in the services
    # (services/jobs.py, services/workflow.py), and the admin would bypass all of them.
    # (The fields below are read-only too, in case a deployment re-enables editing.)
    readonly_fields = (
        "code",
        "status",
        "retry_count",
        "is_archived",
        "validation_results",
        "error_message",
        "cancel_reason",
        "version",
        "republished_from",
    )


@admin.register(PublishDestination)
class PublishDestinationAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
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
    )

    search_fields = ("name", "path")

    ordering = ("name",)


@admin.register(PublishValidationRule)
class PublishValidationRuleAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "rule_type",
        "action",
        "is_active",
        "order",
    )

    list_filter = (
        "rule_type",
        "is_active",
    )

    search_fields = ("name",)

    ordering = ("order",)
