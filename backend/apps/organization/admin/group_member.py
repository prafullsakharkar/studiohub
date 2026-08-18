from django.contrib import admin

from apps.organization.models import GroupMember


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
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
