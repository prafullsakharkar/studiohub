from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import PersonalAccessToken


@admin.register(PersonalAccessToken)
class PersonalAccessTokenAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "user",
        "prefix",
        "expires_at",
        "last_used_at",
        "last_used_ip",
        "created_at",
    )

    search_fields = ("name", "prefix", "user__email", "user__username")

    # The hashed token is never reversible — keep it out of forms and lists.
    readonly_fields = ("hashed_token", "scopes")

    list_select_related = ("user",)
