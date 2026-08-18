from django.contrib import admin

from apps.organization.models import Branding


@admin.register(Branding)
class BrandingAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "organization",
        "theme",
        "created_at",
    )

    list_filter = ("theme",)

    search_fields = (
        "name",
        "organization__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
