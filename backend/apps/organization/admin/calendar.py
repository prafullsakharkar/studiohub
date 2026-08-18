from django.contrib import admin

from apps.organization.models import Calendar


@admin.register(Calendar)
class CalendarAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organization",
        "color",
        "is_default",
        "is_public",
        "created_at",
    )

    list_filter = (
        "is_default",
        "is_public",
        "organization",
    )

    search_fields = (
        "name",
        "organization__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
