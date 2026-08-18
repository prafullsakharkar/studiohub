from django.contrib import admin

from apps.organization.models import OrganizationMembership


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "organization",
        "department",
        "team",
        "role",
        "status",
        "is_primary",
        "created_at",
    )

    list_filter = (
        "status",
        "organization",
        "department",
    )

    search_fields = (
        "user__email",
        "organization__name",
    )

    readonly_fields = (
        "id",
        "joined_at",
        "left_at",
        "created_at",
        "updated_at",
    )
