from apps.identity.api.serializers.base import (
    IdentitySerializer,
)
from apps.identity.models import (
    LoginHistory,
)

LIST_FIELDS = (
    "id",
    "uuid",
    "user",
    "login_type",
    "login_method",
    "status",
    "ip_address",
    "created_at",
)

DETAIL_FIELDS = LIST_FIELDS + (
    "user_agent",
    "location",
    "mfa_enabled",
    "mfa_type",
    "session_id",
    "device_name",
    "device_type",
    "browser",
    "browser_version",
    "operating_system",
    "failure_reason",
)


class LoginHistoryListSerializer(
    IdentitySerializer,
):
    class Meta(
        IdentitySerializer.Meta,
    ):
        model = LoginHistory
        fields = LIST_FIELDS
        read_only_fields = LIST_FIELDS


class LoginHistoryDetailSerializer(
    IdentitySerializer,
):
    class Meta(
        IdentitySerializer.Meta,
    ):
        model = LoginHistory
        fields = DETAIL_FIELDS
        read_only_fields = DETAIL_FIELDS
