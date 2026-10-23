from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.identity.admin.ledger import ReadOnlyLedgerAdminMixin
from apps.identity.models import UserSession


@admin.register(UserSession)
class UserSessionAdmin(ReadOnlyLedgerAdminMixin, PlatformScopedModelAdmin):
    list_display = (
        "user",
        "status",
        "authentication_method",
        "device_type",
        "browser",
        "created_at",
    )

    list_filter = ("status", "authentication_method", "device_type")

    search_fields = (
        "user__email",
        "user__username",
        "session_key",
        "access_token_jti",
    )

    # Token material is never reversible — keep it out of forms and lists.
    readonly_fields = ("session_key", "access_token_jti", "refresh_token_jti")

    list_select_related = ("user",)
