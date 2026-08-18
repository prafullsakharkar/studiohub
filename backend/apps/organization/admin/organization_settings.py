from django.contrib import admin

from apps.organization.models import OrganizationSettings


@admin.register(OrganizationSettings)
class OrganizationSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "organization",
        "timezone",
        "language",
        "currency",
        "date_format",
        "time_format",
        "allow_remote_work",
        "allow_overtime",
        "created_at",
    )

    list_filter = (
        "timezone",
        "language",
        "currency",
        "allow_remote_work",
        "allow_overtime",
    )

    search_fields = (
        "organization__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
