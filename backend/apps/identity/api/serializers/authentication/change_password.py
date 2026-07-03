from django.contrib.auth.password_validation import (
    validate_password,
)
from rest_framework import serializers

from apps.identity.services.password import (
    PasswordService,
)


class ChangePasswordSerializer(serializers.Serializer):

    old_password = serializers.CharField()

    new_password = serializers.CharField()

    def validate_new_password(self, value):

        validate_password(value)

        return value

    def save(self, **kwargs):

        PasswordService.change_password(
            user=self.context["request"].user,
            old_password=self.validated_data["old_password"],
            new_password=self.validated_data["new_password"],
        )
