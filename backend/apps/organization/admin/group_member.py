from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.organization.models import GroupMember


@admin.register(GroupMember)
class GroupMemberAdmin(OrganizationScopedModelAdmin):
    organization_lookup = "group__organization"
    list_display = (
        "user",
        "group",
        "is_owner",
        "is_manager",
        "created_at",
    )

    list_filter = (
        "is_owner",
        "is_manager",
    )

    search_fields = (
        "user__email",
        "group__name",
    )

    readonly_fields = (
        "id",
        "joined_at",
        "left_at",
        "created_at",
        "updated_at",
    )
