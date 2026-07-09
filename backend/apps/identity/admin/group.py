from django.contrib import admin

from apps.identity.models import Group


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "status",
        "created_at",
    )

    list_filter = ("status",)

    search_fields = (
        "name",
        "code",
    )

    readonly_fields = (
        "uuid",
        "created_at",
        "updated_at",
    )
