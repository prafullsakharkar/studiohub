from typing import Any, override

from django.contrib.auth.password_validation import (
    validate_password,
)
from rest_framework import serializers

from apps.identity.services.password import (
    PasswordService,
)


class ChangePasswordSerializer(serializers.Serializer[Any]):

    old_password = serializers.CharField()

    new_password = serializers.CharField()

    # Optional so existing callers that never sent it keep working; when a client does send it, a
    # mismatch is rejected as ``reset-password`` rejects it (docs/sync Q-03). Without this a typo
    # in the confirmation field silently set a password the user could not reproduce.
    confirm_password: serializers.CharField = serializers.CharField(required=False, allow_blank=True)

    def validate_new_password(self, value):

        validate_password(value)

        return value

    @override
    def validate(self, attrs: dict[str, str]) -> dict[str, str]:

        confirm: str | None = attrs.get("confirm_password")

        if confirm is not None and confirm != attrs["new_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."},
            )

        return attrs

    def save(self, **kwargs):

        PasswordService.change_password(
            user=self.context["request"].user,
            old_password=self.validated_data["old_password"],
            new_password=self.validated_data["new_password"],
            request=self.context["request"],
        )
