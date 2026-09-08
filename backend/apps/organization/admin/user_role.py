from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import UserRole


@admin.register(UserRole)
class UserRoleAdmin(OrganizationScopedModelAdmin):
    organization_lookup = "role__organization"
    list_display = (
        "user",
        "role",
        "created_at",
    )

    list_filter = (
        "role",
    )

    search_fields = (
        "user__email",
        "role__name",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
