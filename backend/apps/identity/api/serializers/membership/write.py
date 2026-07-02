from rest_framework import serializers

from apps.identity.api.serializers.membership.base import MembershipBaseSerializer


class MembershipWriteSerializer(
    MembershipBaseSerializer,
):

    user = serializers.UUIDField()

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
