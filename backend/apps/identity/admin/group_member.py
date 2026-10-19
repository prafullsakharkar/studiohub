from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import GroupMember


@admin.register(GroupMember)
class GroupMemberAdmin(PlatformScopedModelAdmin):
    list_display = (
        "group",
        "user",
        "is_owner",
        "is_manager",
        "joined_at",
        "left_at",
    )

    list_filter = ("is_owner", "is_manager")

    search_fields = (
        "group__name",
        "group__code",
        "user__email",
        "user__username",
    )

    autocomplete_fields = ("group", "user")

    list_select_related = ("group", "user")
