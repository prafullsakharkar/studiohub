from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.models import ApiKey


@admin.register(ApiKey)
class ApiKeyAdmin(PlatformScopedModelAdmin):
    list_display = (
        "name",
        "prefix",
        "owner",
        "expires_at",
        "created_at",
    )

    search_fields = ("name", "prefix", "owner__email", "owner__username")

    # The hashed key is never reversible — keep it out of forms and lists.
    readonly_fields = ("hashed_key", "scopes")

    list_select_related = ("owner",)
