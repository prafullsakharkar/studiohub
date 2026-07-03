from rest_framework import serializers

from .base import InvitationBaseSerializer


class InvitationWriteSerializer(
    InvitationBaseSerializer,
):

    organization = serializers.UUIDField()

    department = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    team = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    office = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    role = serializers.UUIDField()

    invited_by = serializers.UUIDField()
