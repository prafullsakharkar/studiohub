from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import GroupRole


@admin.register(GroupRole)
class GroupRoleAdmin(PlatformScopedModelAdmin):
    list_display = (
        "group",
        "role",
        "created_at",
    )

    search_fields = ("group__name", "group__code", "role__name", "role__code")

    autocomplete_fields = ("group", "role")

    list_select_related = ("group", "role")
