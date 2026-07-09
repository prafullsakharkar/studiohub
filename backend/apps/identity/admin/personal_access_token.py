from django.contrib import admin

from apps.identity.models import PersonalAccessToken


@admin.register(PersonalAccessToken)
class PersonalAccessTokenAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "user",
        "is_active",
        "expires_at",
        "last_used_at",
    )

    list_filter = ("is_active",)

    search_fields = (
        "name",
        "prefix",
        "user__email",
    )

    readonly_fields = (
        "uuid",
        "prefix",
        "hashed_token",
        "last_used_at",
        "last_used_ip",
        "created_at",
        "updated_at",
    )
