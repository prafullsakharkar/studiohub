from apps.identity.validators.invitation import (
    InvitationValidator,
)

from .write import InvitationWriteSerializer


class InvitationCreateSerializer(
    InvitationWriteSerializer,
):

    def validate(self, attrs):

        InvitationValidator.validate_unique_pending_invitation(
            organization=attrs["organization"],
            email=attrs["email"],
        )

        return attrs

    def create(self, validated_data):

        return self.context["view"].service_class.create(**validated_data)
