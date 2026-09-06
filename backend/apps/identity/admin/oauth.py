from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.identity.models import OAuthAccount, OAuthProvider


@admin.register(OAuthProvider)
class OAuthProviderAdmin(StudioHubModelAdmin):
    """Admin for OAuthProvider."""

    list_display = (
        "name",
        "is_active",
        "created_at",
    )

    list_filter = ("is_active",)

    search_fields = ("name",)

    # Client secrets are reversible credentials: never display or edit them.
    exclude = ("client_secret",)


@admin.register(OAuthAccount)
class OAuthAccountAdmin(StudioHubModelAdmin):
    """Admin for OAuthAccount."""

    list_display = (
        "provider",
        "user",
        "provider_account_id",
        "is_connected",
        "last_connected_at",
    )

    list_filter = (
        "is_connected",
        "provider",
    )

    search_fields = (
        "provider_account_id",
        "user__email",
    )

    autocomplete_fields = ("user", "provider")

    list_select_related = ("user", "provider")

    # Tokens are reversible credentials: never display or edit them.
    exclude = ("access_token", "refresh_token")
