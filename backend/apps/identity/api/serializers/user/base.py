
from typing import Literal

from rest_framework import serializers

from apps.identity.models import User

from ..base import IdentitySerializer


class UserBaseSerializer(
    IdentitySerializer,
):
    # ADR-0039: "ldap" for an account made from the directory (its password lives there).
    auth_source = serializers.SerializerMethodField()

    class Meta(
        IdentitySerializer.Meta,
    ):
        model = User

        fields = (
            "id",
            "uuid",
            "email",
            "is_active",
            "is_staff",
            "is_email_verified",
            "last_seen",
            "display_name",
            "full_name",
            "mfa_required",
            "auth_source",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "uuid",
            "is_email_verified",
            "last_seen",
            "display_name",
            "full_name",
            "mfa_required",
            "created_at",
            "updated_at",
        )

    def get_auth_source(self, obj) -> Literal["local", "ldap"]:
        flagged = getattr(obj, "is_directory_account", None)
        if flagged is None:
            from apps.identity.selectors.external_identity import ExternalIdentitySelector

            flagged = ExternalIdentitySelector.is_directory_user(obj)
        return "ldap" if flagged else "local"


# Backwards-compatible alias (the public API exposes this name).
UserSerializer = UserBaseSerializer
