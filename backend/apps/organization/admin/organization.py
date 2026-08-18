from django.contrib import admin

from apps.organization.models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "organization_type",
        "status",
        "country",
        "created_at",
    )

    list_filter = (
        "organization_type",
        "status",
        "country",
    )

    search_fields = (
        "name",
        "code",
        "slug",
    )

    readonly_fields = (
        "id",
        "slug",
        "created_at",
        "updated_at",
    )
