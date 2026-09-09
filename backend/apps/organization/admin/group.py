from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import Group


@admin.register(Group)
class GroupAdmin(OrganizationScopedModelAdmin):
    list_display = (
        "name",
        "code",
        "organization",
        "is_system",
        "created_at",
    )

    list_filter = (
        "is_system",
        "organization",
    )

    search_fields = (
        "name",
        "code",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
