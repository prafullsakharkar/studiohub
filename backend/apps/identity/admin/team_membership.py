from django.contrib import admin

from apps.identity.models import TeamMembership


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "team",
        "user",
        "role",
        "created_at",
    )

    list_filter = ("role",)

    search_fields = (
        "team__name",
        "user__email",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
