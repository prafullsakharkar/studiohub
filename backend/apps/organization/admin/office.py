from django.contrib import admin

from apps.organization.models import Office


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "office_type",
        "organization",
        "city",
        "country",
        "is_headquarters",
        "created_at",
    )

    list_filter = (
        "office_type",
        "is_headquarters",
        "country",
    )

    search_fields = (
        "name",
        "code",
        "city",
        "country",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
